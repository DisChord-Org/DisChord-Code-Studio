use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::thread;

use log::{error, info};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{Emitter, Manager};

use crate::commands::config_sections::section_values;
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

const BASH_RC: &str = include_str!("terminal_prompts/bash.sh");
const ZSH_RC: &str = include_str!("terminal_prompts/zsh.sh");
const POWERSHELL_PROMPT: &str = include_str!("terminal_prompts/powershell.ps1");

fn single_line(script: &str) -> String {
    script
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .collect::<Vec<_>>()
        .join(" ")
}

fn with_caps(script: &str) -> String {
    script.replace("@CAP_L@", "\u{E0B6}").replace("@CAP_R@", "\u{E0B4}")
}

fn apply_prompt_style(app_handle: &tauri::AppHandle, cmd: &mut CommandBuilder, shell: &str, workflows_dir: &Path) {
    cmd.env("DISCHORD_WORKFLOWS", workflows_dir);

    let Ok(dir) = app_handle.path().app_config_dir().map(|d| d.join("terminal")) else { return };
    let name = Path::new(shell).file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();

    match name.as_str() {
        "bash" => {
            let rc = dir.join("bashrc");
            if fs::create_dir_all(&dir).and_then(|_| fs::write(&rc, with_caps(BASH_RC))).is_ok() {
                cmd.arg("--rcfile");
                cmd.arg(rc);
            }
        }
        "zsh" => {
            let zdotdir = dir.join("zsh");
            if fs::create_dir_all(&zdotdir).and_then(|_| fs::write(zdotdir.join(".zshrc"), with_caps(ZSH_RC))).is_ok() {
                if let Ok(original) = std::env::var("ZDOTDIR") {
                    cmd.env("DISCHORD_ORIG_ZDOTDIR", original);
                }
                cmd.env("ZDOTDIR", zdotdir);
            }
        }
        "powershell" | "pwsh" => {
            cmd.args(["-NoLogo", "-NoExit", "-Command", &single_line(POWERSHELL_PROMPT)]);
        }
        "sh" | "dash" => {
            cmd.env("PS1", "╰─> ");
        }
        _ => {}
    }
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize { rows: rows.max(1), cols: cols.max(1), pixel_width: 0, pixel_height: 0 }
}

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
pub fn terminal_open(app_handle: tauri::AppHandle, project_name: String, cols: u16, rows: u16, rounded: bool) -> Result<String, String> {
    let cwd = project_path(&app_handle, &project_name);

    let pair = native_pty_system().openpty(pty_size(cols, rows)).map_err(|e| e.to_string())?;

    let shell = default_shell();
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);
    for var in NPM_ENV_VARS_TO_STRIP {
        cmd.env_remove(var);
    }
    if let Some(path) = build_path_env(&app_handle) {
        cmd.env("PATH", path);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if rounded {
        cmd.env("DISCHORD_ROUNDED", "1");
    }

    let use_dischord_prompt = section_values(&app_handle, "terminal").get("prompt").and_then(|v| v.as_str()) == Some("dischord");
    if use_dischord_prompt {
        let workflows_dir = cwd.parent().map(Path::to_path_buf).unwrap_or_else(|| cwd.clone());
        apply_prompt_style(&app_handle, &mut cmd, &shell, &workflows_dir);
    }

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn syntax_check(shell: &str, script: &str) {
        let path = std::env::temp_dir().join(format!("dischord-prompt-test-{}-{}", shell, std::process::id()));
        fs::write(&path, with_caps(script)).unwrap();
        let output = Command::new(shell).arg("-n").arg(&path).output();
        let _ = fs::remove_file(&path);

        match output {
            Ok(out) => assert!(out.status.success(), "{} rejected its prompt script: {}", shell, String::from_utf8_lossy(&out.stderr)),
            Err(_) => eprintln!("{} no está instalado: se omite la comprobación de sintaxis", shell),
        }
    }

    #[test]
    fn bash_prompt_has_valid_syntax() {
        syntax_check("bash", BASH_RC);
    }

    #[test]
    fn zsh_prompt_has_valid_syntax() {
        syntax_check("zsh", ZSH_RC);
    }

    #[test]
    fn placeholders_are_all_replaced() {
        for script in [BASH_RC, ZSH_RC] {
            assert!(script.contains("@CAP_L@") && script.contains("@CAP_R@"));
            let filled = with_caps(script);
            assert!(!filled.contains("@CAP_") && filled.contains('\u{E0B6}') && filled.contains('\u{E0B4}'));
        }
    }

    #[test]
    fn powershell_prompt_is_one_balanced_line() {
        let line = single_line(POWERSHELL_PROMPT);
        assert!(!line.contains('\n') && !line.contains('\r'));
        assert!(!line.contains("# "), "comments must be stripped");
        // Square brackets are not checked: the ANSI color strings contain lone `[`.
        for (open, close) in [('{', '}'), ('(', ')')] {
            assert_eq!(line.matches(open).count(), line.matches(close).count(), "unbalanced {}{}", open, close);
        }
        assert!(line.starts_with("function prompt {") && line.ends_with('}'));
    }
}
