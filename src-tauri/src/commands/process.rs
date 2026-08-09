use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;

use tauri::{Emitter, State};
use log::{info, error, warn};

use crate::ChildProcessState;
use crate::paths::project_path;
use crate::platform::silent_command;

#[tauri::command]
pub fn run_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>, project_name: String) -> Result<(), String> {
    let project_dir = project_path(&app_handle, &project_name);

    let mut chord_file = project_dir.clone();
    chord_file.push("src");
    chord_file.push("index.chord");

    if !chord_file.exists() {
        error!("Fallo al ejecutar: No existe index.chord en {:?}", chord_file);
        return Err(format!("No se encontró el archivo: {:?}", chord_file));
    }

    info!("Iniciando ejecución del proyecto: {}", project_name);

    let mut command = silent_command("chord");
    command.current_dir(&project_dir);
    command.env("NODE_OPTIONS", "--experimental-default-type=module");

    if let Ok(path) = std::env::var("PATH") {
        command.env("PATH", path);
    }

    command.arg("run")
        .arg("src/index.chord")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| {
        error!("No se pudo spawnear el proceso 'chord': {}", e);
        e.to_string()
    })?;

    let pid = child.id();
    info!("Proceso 'chord' iniciado con PID: {}", pid);

    let stdout = child.stdout.take().expect("Fallo al capturar stdout");
    let stderr = child.stderr.take().expect("Fallo al capturar stderr");

    {
        let mut lock = state.0.lock().unwrap();
        *lock = Some(child);
    }

    let state_arc = state.0.clone();
    let handle_clone = app_handle.clone();

    thread::spawn(move || {
        let handle_out = handle_clone.clone();
        let stdout_thread = thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(l) = line {
                    let _ = handle_out.emit("terminal-data", format!("{}\r\n", l));
                }
            }
        });

        let handle_err = app_handle.clone();
        let stderr_thread = thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    let _ = handle_err.emit("terminal-data", format!("\x1b[31m{}\r\n\x1b[0m", l));
                }
            }
        });

        let _ = stdout_thread.join();
        let _ = stderr_thread.join();

        let mut lock = state_arc.lock().unwrap();
        if let Some(mut child) = lock.take() {
            let _ = child.wait();
            info!("El proceso hijo {} ha finalizado", pid);
        }

        let _ = handle_clone.emit("terminal-data", "\x1b[1;32m[!] Ejecución finalizada.\x1b[0m\r\n");
        *lock = None;
    });

    Ok(())
}

#[tauri::command]
pub fn stop_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>) -> Result<String, String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(mut child) = lock.take() {
        let pid = child.id();
        info!("Solicitud de detención para proceso PID: {}", pid);

        #[cfg(target_os = "windows")]
        {
            let res = silent_command("taskkill")
                .arg("/F")
                .arg("/T")
                .arg("/PID")
                .arg(pid.to_string())
                .spawn();

            if res.is_err() {
                error!("Fallo al ejecutar taskkill para PID {}", pid);
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Err(e) = child.kill() {
                error!("Fallo al matar el proceso {}: {}", pid, e);
            }
        }

        let _ = app_handle.emit("terminal-data", "\x1b[1;31m[!] Proceso detenido.\x1b[0m\r\n");
        info!("Proceso {} detenido correctamente.", pid);
        Ok("Proceso detenido".into())
    } else {
        warn!("Se intentó detener un proceso, pero no hay ninguno activo");
        Err("No hay ningún proceso en ejecución".into())
    }
}

#[tauri::command]
pub fn open_in_explorer(app_handle: tauri::AppHandle, project_name: String) -> Result<(), String> {
    let path = project_path(&app_handle, &project_name);

    if !path.exists() {
        warn!("Intento de abrir explorador en ruta inexistente: {:?}", path);
        return Err("El proyecto no existe".to_string());
    }

    info!("Abriendo explorador de archivos en: {:?}", path);

    let cmd = if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&path).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(&path).spawn()
    } else {
        Command::new("xdg-open").arg(&path).spawn()
    };

    cmd.map_err(|e| {
        error!("Fallo al abrir el explorador: {}", e);
        e.to_string()
    })?;

    Ok(())
}
