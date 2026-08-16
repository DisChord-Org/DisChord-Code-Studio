mod window;
mod ide;
mod cli;
mod runtime;

use tauri::{Emitter, Manager};
use serde::{Serialize, Deserialize};
use log::error;

use crate::UpdateState;

pub use ide::run_ide_update;
pub use cli::setup_environment;
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

#[tauri::command]
pub fn get_update_state(app_handle: tauri::AppHandle) -> Vec<UpdateProgress> {
    let state = app_handle.state::<UpdateState>();
    let map = state.0.lock().unwrap();
    map.values().cloned().collect()
}

// the completly sequency,
// never in parallel, because the binaries share the same folder (~/.dischord/bin) and running them in parallel was producing corrupted binaries when the IDE auto-update killed the process in the middle of a concurrent download.:
//   1. Editor (autoactualización del propio IDE)
//   2. CLI ('chord')
//   3. Compilador
//   4. Node.js embebido
//   5. pnpm embebido
pub fn run_full_update_sequence(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        if let Err(e) = window::open_update_window(&app_handle) {
            error!("No se pudo abrir la ventana de actualización: {}", e);
        }

        // 1. Editor
        tauri::async_runtime::block_on(run_ide_update(app_handle.clone()));

        // 2. CLI
        let cli_ready = cli::ensure_cli_updated(&app_handle);

        // 3. Compilador (solo tiene sentido si la CLI quedó operativa)
        if cli_ready {
            cli::update_compiler(&app_handle);
        } else {
            emit_progress(&app_handle, "compiler", "error", None, None, None, None,
                Some("No se pudo comprobar: la CLI no está disponible.".into()));
        }

        // 4 y 5. Node.js y pnpm (ensure_runtime ya los hace en este orden)
        runtime::ensure_runtime(app_handle);
    });
}

#[tauri::command]
pub async fn start_full_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    run_full_update_sequence(app_handle);
    Ok(())
}
