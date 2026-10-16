use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::thread;
use std::time::Duration;

use log::warn;

use super::stream::stream_to_terminal;
use crate::log_err::LogErr;
use crate::output::{emit_line, LineKind};
use crate::platform::{build_path_env, pnpm_command};

const PNPM_INSTALL_ATTEMPTS: u32 = 3;
const PNPM_RETRY_DELAY: Duration = Duration::from_secs(2);

fn declared_dependency_names(package_json_path: &Path) -> Vec<String> {
    let Ok(text) = fs::read_to_string(package_json_path) else { return Vec::new() };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { return Vec::new() };

    let mut names = Vec::new();
    for key in ["dependencies", "devDependencies"] {
        if let Some(obj) = json.get(key).and_then(|v| v.as_object()) {
            names.extend(obj.keys().cloned());
        }
    }
    names
}

fn dependencies_satisfied(project_dir: &Path) -> bool {
    let node_modules = project_dir.join("node_modules");
    if !node_modules.exists() {
        return false;
    }

    let names = declared_dependency_names(&project_dir.join("package.json"));
    names.iter().all(|name| node_modules.join(name).exists())
}

fn run_pnpm_install_once(app_handle: &tauri::AppHandle, project_dir: &Path) -> Result<(), String> {
    let mut command = pnpm_command(app_handle)
        .ok_or("No se encontró pnpm para instalar las dependencias del proyecto")?;
    command.current_dir(project_dir);
    if let Some(path) = build_path_env(app_handle) {
        command.env("PATH", path);
    }
    command.arg("install")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().log_err("No se pudo ejecutar 'pnpm install'")?;

    let (Some(stdout), Some(stderr)) = (child.stdout.take(), child.stderr.take()) else {
        let _ = child.kill();
        let _ = child.wait();
        return Err("Fallo al capturar la salida de 'pnpm install'".into());
    };

    let (stdout_thread, stderr_thread) = stream_to_terminal(app_handle, stdout, stderr);
    let _ = stdout_thread.join();
    let _ = stderr_thread.join();

    let status = child.wait().log_err("Fallo esperando a 'pnpm install'")?;
    if !status.success() {
        return Err("Fallo al instalar las dependencias del proyecto ('pnpm install')".into());
    }

    Ok(())
}

pub(super) fn ensure_dependencies_installed(app_handle: &tauri::AppHandle, project_dir: &Path) -> Result<(), String> {
    if !project_dir.join("package.json").exists() || dependencies_satisfied(project_dir) {
        return Ok(());
    }

    emit_line(app_handle, LineKind::Info, "Instalando dependencias del proyecto (pnpm install)...");

    let mut last_err = String::new();
    for attempt in 1..=PNPM_INSTALL_ATTEMPTS {
        match run_pnpm_install_once(app_handle, project_dir) {
            Ok(()) => {
                emit_line(app_handle, LineKind::Success, "Dependencias instaladas correctamente.");
                return Ok(());
            }
            Err(e) => {
                last_err = e;
                if attempt < PNPM_INSTALL_ATTEMPTS {
                    warn!("'pnpm install' falló (intento {}/{}): {}", attempt, PNPM_INSTALL_ATTEMPTS, last_err);
                    emit_line(
                        app_handle,
                        LineKind::Warning,
                        format!("'pnpm install' falló, reintentando ({}/{})...", attempt, PNPM_INSTALL_ATTEMPTS),
                    );
                    thread::sleep(PNPM_RETRY_DELAY);
                }
            }
        }
    }

    Err(last_err)
}
