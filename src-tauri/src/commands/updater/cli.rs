use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::io::{BufRead, BufReader};
use std::thread;

use tauri::Manager;
use serde::Deserialize;
use log::{info, error, warn};

use crate::platform;
use super::window::open_update_window;
use super::ide::run_ide_update;

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

fn cli_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let bin_dir = platform::bin_dir(app_handle)?;
    let tool_filename = if cfg!(windows) { "chord.exe" } else { "chord" };
    Some(bin_dir.join(tool_filename))
}

pub fn is_cli_installed(app_handle: &tauri::AppHandle) -> bool {
    cli_binary_path(app_handle).map(|p| p.exists()).unwrap_or(false)
}

fn install_cli_binary(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dest_path = cli_binary_path(app_handle)
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

pub fn run_initial_cli_install(app_handle: tauri::AppHandle) {
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.hide();
    }

    if let Err(e) = open_update_window(&app_handle) {
        error!("No se pudo abrir la ventana de actualización para instalar la CLI: {}", e);
        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.show();
        }
        return;
    }

    super::emit_progress(&app_handle, "cli", "installing", None, None, None, None,
        Some("Instalando la CLI de DisChord por primera vez...".into()));

    thread::spawn(move || {
        match install_cli_binary(&app_handle) {
            Ok(installed_path) => {
                info!("CLI instalada correctamente en el primer arranque");
                run_cli_compiler_update_inner(app_handle.clone(), Some(installed_path), true);

                let ide_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    run_ide_update(ide_handle).await;
                });
            },
            Err(e) => {
                error!("No se pudo instalar la CLI en el primer arranque: {}", e);
                super::emit_error_both(&app_handle, e);
            }
        }
    });
}

pub fn run_cli_compiler_update(app_handle: tauri::AppHandle) {
    run_cli_compiler_update_inner(app_handle, None, false);
}

fn run_cli_compiler_update_inner(
    app_handle: tauri::AppHandle,
    binary_override: Option<PathBuf>,
    already_retried: bool,
) {
    super::emit_progress(&app_handle, "cli", "checking", None, None, None, None, None);
    super::emit_progress(&app_handle, "compiler", "checking", None, None, None, None, None);

    thread::spawn(move || {
        let binary: std::ffi::OsString = binary_override
            .clone()
            .map(|p| p.into_os_string())
            .unwrap_or_else(|| "chord".into());

        let mut command = platform::silent_command(&binary);
        command.arg("update").arg("all").arg("--json");
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        let spawn_res = command.spawn();

        match spawn_res {
            Ok(mut child) => {
                let stdout = child.stdout.take().expect("Fallo al capturar stdout");
                let reader = BufReader::new(stdout);

                for line in reader.lines() {
                    let Ok(l) = line else { continue; };
                    let trimmed = l.trim();
                    if trimmed.is_empty() { continue; }

                    match serde_json::from_str::<CliProgressLine>(trimmed) {
                        Ok(evt) if evt.tool == "cli" || evt.tool == "compiler" => {
                            super::emit_progress(
                                &app_handle,
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
                            if clean_line.is_empty() { continue; }

                            let lower = clean_line.to_lowercase();
                            let target = if lower.contains("compilador") { "compiler" } else { "cli" };
                            super::emit_progress(&app_handle, target, "downloading", None, None, None, None, Some(clean_line));
                        }
                    }
                }

                let status = child.wait();
                match status {
                    Ok(s) if s.success() => {
                        info!("Actualización de CLI/Compilador finalizada con éxito");
                    },
                    _ => {
                        warn!("'chord update all --json' terminó con un código no exitoso");
                    }
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound && !already_retried => {
                warn!("'{}' no se encontró al intentar actualizar. Instalando la CLI ahora.", binary.to_string_lossy());
                super::emit_progress(&app_handle, "cli", "installing", None, None, None, None,
                    Some("La CLI no estaba instalada. Instalándola ahora...".into()));

                match install_cli_binary(&app_handle) {
                    Ok(installed_path) => {
                        info!("CLI instalada tras detectar que faltaba; reintentando la actualización");
                        run_cli_compiler_update_inner(app_handle.clone(), Some(installed_path), true);
                    },
                    Err(install_err) => {
                        error!("Fallo al instalar la CLI tras detectar que faltaba: {}", install_err);
                        super::emit_error_both(&app_handle, install_err);
                    }
                }
            },
            Err(e) => {
                error!("Fallo al ejecutar 'chord update': {}", e);
                super::emit_error_both(&app_handle, e.to_string());
            }
        }
    });
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
