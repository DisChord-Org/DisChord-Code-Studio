use std::fs;
use std::process::Stdio;
use std::io::{BufRead, BufReader};
use std::thread;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{Manager, Emitter, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;

use serde::{Serialize, Deserialize};
use log::{info, error, warn};

use crate::UpdateState;
use crate::platform::{self, silent_command};

#[derive(Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub target: String,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

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

fn emit_progress(
    app_handle: &tauri::AppHandle,
    target: &str,
    phase: &str,
    percent: Option<f64>,
    current_bytes: Option<u64>,
    total_bytes: Option<u64>,
    version: Option<String>,
    message: Option<String>,
) {
    let payload = UpdateProgress {
        target: target.to_string(),
        phase: phase.to_string(),
        percent,
        current_bytes,
        total_bytes,
        version,
        message,
    };

    if let Some(state) = app_handle.try_state::<UpdateState>() {
        if let Ok(mut map) = state.0.lock() {
            map.insert(target.to_string(), payload.clone());
        }
    }

    let _ = app_handle.emit("update-progress", payload);
}

fn emit_error_both(app_handle: &tauri::AppHandle, message: String) {
    emit_progress(app_handle, "cli", "error", None, None, None, None, Some(message.clone()));
    emit_progress(app_handle, "compiler", "error", None, None, None, None, Some(message));
}

#[tauri::command]
pub fn get_update_state(app_handle: tauri::AppHandle) -> Vec<UpdateProgress> {
    let state = app_handle.state::<UpdateState>();
    let map = state.0.lock().unwrap();
    map.values().cloned().collect()
}

fn force_focus(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();

    let window_clone = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(200));
        let _ = window_clone.set_always_on_top(false);
    });
}

fn open_update_window(app_handle: &tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app_handle.get_webview_window("update") {
        force_focus(&w);
        return Ok(());
    }

    info!("Abriendo ventana de actualización");

    let app_for_event = app_handle.clone();

    let window = WebviewWindowBuilder::new(app_handle, "update", WebviewUrl::App("index.html".into()))
        .title("Actualizando DisChord")
        .inner_size(800.0, 600.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .center()
        .visible(false)
        .build()
        .map_err(|e| {
            error!("No se pudo crear la ventana de actualización: {}", e);
            e.to_string()
        })?;

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            info!("Ventana de actualización cerrada, restaurando la principal");
            if let Some(main) = app_for_event.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn mark_update_window_ready(app_handle: tauri::AppHandle) {
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.hide();
    }

    if let Some(update) = app_handle.get_webview_window("update") {
        force_focus(&update);
    }
}

pub async fn run_ide_update(app_handle: tauri::AppHandle) {
    emit_progress(&app_handle, "ide", "checking", None, None, None, None, None);

    let updater = match app_handle.updater() {
        Ok(u) => u,
        Err(e) => {
            error!("No se pudo obtener el servicio de updater: {}", e);
            emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            info!("Actualización del IDE encontrada: {}", version);

            if let Err(e) = open_update_window(&app_handle) {
                warn!("No se pudo abrir la ventana de actualización para el IDE: {}", e);
            }

            emit_progress(&app_handle, "ide", "downloading", Some(0.0), Some(0), None, Some(version.clone()), None);

            let downloaded = Arc::new(AtomicU64::new(0));
            let downloaded_clone = downloaded.clone();
            let progress_handle = app_handle.clone();
            let version_clone = version.clone();

            let install_result = update.download_and_install(
                move |chunk_len, total_len| {
                    let total = downloaded_clone.fetch_add(chunk_len as u64, Ordering::SeqCst) + chunk_len as u64;
                    let percent = total_len.map(|t| if t > 0 { (total as f64 / t as f64) * 100.0 } else { 0.0 });
                    emit_progress(&progress_handle, "ide", "downloading", percent, Some(total), total_len, Some(version_clone.clone()), None);
                },
                || {
                    info!("Descarga del IDE finalizada, instalando...");
                }
            ).await;

            match install_result {
                Ok(_) => {
                    emit_progress(&app_handle, "ide", "installing", Some(100.0), None, None, Some(version.clone()), None);
                    info!("IDE actualizado correctamente a {}", version);
                    emit_progress(&app_handle, "ide", "done", Some(100.0), None, None, Some(version), None);
                },
                Err(e) => {
                    error!("Error al instalar la actualización del IDE: {}", e);
                    emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
                }
            }
        },
        Ok(None) => {
            info!("El IDE está actualizado");
            emit_progress(&app_handle, "ide", "up_to_date", None, None, None, None, None);
        },
        Err(e) => {
            error!("Error al comprobar actualizaciones del IDE: {}", e);
            emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
        }
    }
}

fn cli_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let bin_dir = platform::bin_dir(app_handle)?;
    let tool_filename = if cfg!(windows) { "chord.exe" } else { "chord" };
    Some(bin_dir.join(tool_filename))
}

pub fn is_cli_installed(app_handle: &tauri::AppHandle) -> bool {
    cli_binary_path(app_handle).map(|p| p.exists()).unwrap_or(false)
}

pub fn install_cli_binary(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
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

    emit_progress(&app_handle, "cli", "installing", None, None, None, None,
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
                emit_error_both(&app_handle, e);
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
    emit_progress(&app_handle, "cli", "checking", None, None, None, None, None);
    emit_progress(&app_handle, "compiler", "checking", None, None, None, None, None);

    thread::spawn(move || {
        let binary: std::ffi::OsString = binary_override
            .clone()
            .map(|p| p.into_os_string())
            .unwrap_or_else(|| "chord".into());

        let mut command = silent_command(&binary);
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
                            emit_progress(
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
                            emit_progress(&app_handle, target, "downloading", None, None, None, None, Some(clean_line));
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
                emit_progress(&app_handle, "cli", "installing", None, None, None, None,
                    Some("La CLI no estaba instalada. Instalándola ahora...".into()));

                match install_cli_binary(&app_handle) {
                    Ok(installed_path) => {
                        info!("CLI instalada tras detectar que faltaba; reintentando la actualización");
                        run_cli_compiler_update_inner(app_handle.clone(), Some(installed_path), true);
                    },
                    Err(install_err) => {
                        error!("Fallo al instalar la CLI tras detectar que faltaba: {}", install_err);
                        emit_error_both(&app_handle, install_err);
                    }
                }
            },
            Err(e) => {
                error!("Fallo al ejecutar 'chord update': {}", e);
                emit_error_both(&app_handle, e.to_string());
            }
        }
    });
}

#[tauri::command]
pub async fn start_full_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    open_update_window(&app_handle)?;

    let ide_handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        run_ide_update(ide_handle).await;
    });

    run_cli_compiler_update(app_handle);

    Ok(())
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
