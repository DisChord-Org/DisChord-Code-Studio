use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::io::{BufRead, BufReader};

use serde::Deserialize;
use log::{info, error, warn};

use crate::platform;

#[derive(Deserialize)]
struct CliProgressLine {
    tool: String,
    phase: String,
    #[serde(default)]
    percent: Option<f64>,
    #[serde(default)]
    current_bytes: Option<u64>,
    #[serde(default)]
    total_bytes: Option<u64>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    message: Option<String>,
}

pub fn is_cli_installed(app_handle: &tauri::AppHandle) -> bool {
    match platform::chord_binary_path(app_handle) {
        Some(path) if path.exists() => platform::command_works(platform::silent_command(&path), "chord"),
        _ => false,
    }
}

fn repair_corrupted_compiler(app_handle: &tauri::AppHandle) {
    let Some(path) = platform::compiler_binary_path(app_handle) else { return };

    if path.exists() && !platform::looks_like_valid_binary(&path) {
        warn!("Compilador corrupto detectado, borrándolo para forzar su reinstalación: {:?}", path);
        if let Err(e) = fs::remove_file(&path) {
            error!("No se pudo borrar el compilador corrupto: {}", e);
        }
    }
}

fn install_cli_binary(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dest_path = platform::chord_binary_path(app_handle)
        .ok_or_else(|| "No se pudo determinar la ruta de instalación de la CLI".to_string())?;

    let bin_dir = dest_path.parent()
        .ok_or_else(|| "Ruta de instalación de la CLI inválida".to_string())?;

    if !bin_dir.exists() {
        fs::create_dir_all(bin_dir).map_err(|e| e.to_string())?;
    }

    platform::download_tool("chord", &dest_path).map_err(|e| e.to_string())?;
    platform::register_bin_dir_in_path(bin_dir).map_err(|e| e.to_string())?;

    Ok(dest_path)
}

fn run_component_update(app_handle: &tauri::AppHandle, component: &str) -> bool {
    super::emit_progress(app_handle, component, "checking", None, None, None, None, None);

    let binary: std::ffi::OsString = platform::chord_binary_path(app_handle)
        .filter(|p| p.exists())
        .map(|p| p.into_os_string())
        .unwrap_or_else(|| "chord".into());

    let mut command = platform::silent_command(&binary);
    command.arg("update").arg(component).arg("--json");
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let child = match command.spawn() {
        Ok(child) => child,
        Err(e) => {
            error!("No se pudo ejecutar 'chord update {}': {}", component, e);
            super::emit_progress(app_handle, component, "error", None, None, None, None, Some(e.to_string()));
            return false;
        }
    };

    let mut child = child;
    let stdout = child.stdout.take().expect("Fallo al capturar stdout");
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let Ok(l) = line else { continue };
        let trimmed = l.trim();
        if trimmed.is_empty() { continue; }

        match serde_json::from_str::<CliProgressLine>(trimmed) {
            Ok(evt) if evt.tool == component => {
                super::emit_progress(
                    app_handle,
                    &evt.tool,
                    &evt.phase,
                    evt.percent,
                    evt.current_bytes,
                    evt.total_bytes,
                    evt.version,
                    evt.message,
                );
            },
            Ok(_) => {},
            Err(_) => {
                let clean_line = trimmed.replace("────────", "").trim().to_string();
                if !clean_line.is_empty() {
                    super::emit_progress(app_handle, component, "downloading", None, None, None, None, Some(clean_line));
                }
            }
        }
    }

    match child.wait() {
        Ok(s) if s.success() => {
            info!("'chord update {} --json' finalizado con éxito", component);
            true
        },
        _ => {
            warn!("'chord update {} --json' terminó con un código no exitoso", component);
            super::emit_progress(app_handle, component, "error", None, None, None, None,
                Some(format!("'chord update {}' falló", component)));
            false
        }
    }
}

pub fn ensure_cli_updated(app_handle: &tauri::AppHandle) -> bool {
    if is_cli_installed(app_handle) {
        return run_component_update(app_handle, "cli");
    }

    super::emit_progress(app_handle, "cli", "installing", None, None, None, None,
        Some("La CLI no está instalada. Instalándola ahora...".into()));

    match install_cli_binary(app_handle) {
        Ok(_) => {
            info!("CLI instalada correctamente");
            super::emit_progress(app_handle, "cli", "done", None, None, None, None, None);
            true
        },
        Err(e) => {
            error!("No se pudo instalar la CLI: {}", e);
            super::emit_progress(app_handle, "cli", "error", None, None, None, None, Some(e));
            false
        }
    }
}

// Paso 3 de la secuencia: solo se llama si el paso 2 (CLI) terminó bien.
pub fn update_compiler(app_handle: &tauri::AppHandle) -> bool {
    repair_corrupted_compiler(app_handle);
    run_component_update(app_handle, "compiler")
}

pub fn setup_environment(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    let bin_dir = platform::bin_dir(handle)
        .ok_or("No se pudo determinar el directorio de binarios")?;

    if !bin_dir.exists() {
        info!("Creando directorio de binarios: {:?}", bin_dir);
        fs::create_dir_all(&bin_dir)?;
    }

    platform::register_bin_dir_in_path(&bin_dir)?;

    Ok(())
}
