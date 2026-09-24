use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::thread;

use log::{error, info};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{Emitter, Manager};

use crate::paths::project_path;
use crate::platform::{build_path_env, NPM_ENV_VARS_TO_STRIP};

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct TerminalState(Mutex<HashMap<String, TerminalSession>>);

static NEXT_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Serialize, Clone)]
struct PtyData {
    id: String,
    data: String,
}

#[derive(Serialize, Clone)]
struct PtyExit {
    id: String,
}

fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize { rows: rows.max(1), cols: cols.max(1), pixel_width: 0, pixel_height: 0 }
}

/// Emits every complete UTF-8 sequence in `pending`, keeping a trailing partial one for the
/// next read so multi-byte characters split across reads aren't corrupted.
fn drain_utf8(pending: &mut Vec<u8>) -> Option<String> {
    if pending.is_empty() {
        return None;
    }
    let valid_up_to = match std::str::from_utf8(pending) {
        Ok(_) => pending.len(),
        Err(e) => match e.error_len() {
            Some(_) => pending.len(),
            None => e.valid_up_to(),
        },
    };
    if valid_up_to == 0 {
        return None;
    }
    let chunk: Vec<u8> = pending.drain(..valid_up_to).collect();
    Some(String::from_utf8_lossy(&chunk).into_owned())
}

#[tauri::command]
pub fn terminal_open(app_handle: tauri::AppHandle, project_name: String, cols: u16, rows: u16) -> Result<String, String> {
    let cwd = project_path(&app_handle, &project_name);

    let pair = native_pty_system().openpty(pty_size(cols, rows)).map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell());
    cmd.cwd(&cwd);
    for var in NPM_ENV_VARS_TO_STRIP {
        cmd.env_remove(var);
    }
    if let Some(path) = build_path_env(&app_handle) {
        cmd.env("PATH", path);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst).to_string();

    app_handle
        .state::<TerminalState>()
        .0
        .lock()
        .unwrap()
        .insert(id.clone(), TerminalSession { master: pair.master, writer, child });

    info!("Terminal interactiva {} abierta en {:?}", id, cwd);

    let reader_handle = app_handle.clone();
    let reader_id = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut pending: Vec<u8> = Vec::new();

        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    if let Some(data) = drain_utf8(&mut pending) {
                        let _ = reader_handle.emit("pty-data", PtyData { id: reader_id.clone(), data });
                    }
                }
            }
        }

        if let Some(mut session) = reader_handle.state::<TerminalState>().0.lock().unwrap().remove(&reader_id) {
            let _ = session.child.kill();
        }
        let _ = reader_handle.emit("pty-exit", PtyExit { id: reader_id });
    });

    Ok(id)
}

#[tauri::command]
pub fn terminal_write(state: tauri::State<'_, TerminalState>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.0.lock().unwrap();
    let session = sessions.get_mut(&id).ok_or("La terminal ya no existe")?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_resize(state: tauri::State<'_, TerminalState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&id).ok_or("La terminal ya no existe")?;
    session.master.resize(pty_size(cols, rows)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_close(state: tauri::State<'_, TerminalState>, id: String) {
    if let Some(mut session) = state.0.lock().unwrap().remove(&id) {
        if let Err(e) = session.child.kill() {
            error!("No se pudo cerrar la terminal {}: {}", id, e);
        }
        info!("Terminal interactiva {} cerrada", id);
    }
}

pub fn close_all(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<TerminalState>();
    let mut sessions = state.0.lock().unwrap();
    for (_, mut session) in sessions.drain() {
        let _ = session.child.kill();
    }
}
