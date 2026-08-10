mod window;
mod ide;
mod cli;
mod runtime;

use tauri::{Emitter, Manager};
use serde::{Serialize, Deserialize};

use crate::UpdateState;

pub use ide::run_ide_update;
pub use cli::{is_cli_installed, run_initial_cli_install, run_cli_compiler_update, setup_environment};
pub use runtime::ensure_runtime;
pub use window::*;

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

#[tauri::command]
pub async fn start_full_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    window::open_update_window(&app_handle)?;

    let ide_handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        run_ide_update(ide_handle).await;
    });

    cli::run_cli_compiler_update(app_handle.clone());

    let runtime_handle = app_handle.clone();
    std::thread::spawn(move || {
        runtime::ensure_runtime(runtime_handle);
    });

    Ok(())
}
