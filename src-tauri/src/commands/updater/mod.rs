mod window;
mod ide;
mod cli;
mod runtime;
mod league;

use tauri::{Emitter, Manager};
use serde::{Serialize, Deserialize};
use log::error;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::UpdateState;

pub use ide::run_ide_update;
pub use cli::setup_environment;
pub use league::*;
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

/// Parameters of a progress event. Build with `Progress::new` and the chained setters.
pub(super) struct Progress<'a> {
    target: &'a str,
    phase: &'a str,
    percent: Option<f64>,
    current_bytes: Option<u64>,
    total_bytes: Option<u64>,
    version: Option<String>,
    message: Option<String>,
}

impl<'a> Progress<'a> {
    pub(super) fn new(target: &'a str, phase: &'a str) -> Self {
        Self { target, phase, percent: None, current_bytes: None, total_bytes: None, version: None, message: None }
    }
    pub(super) fn percent(mut self, percent: Option<f64>) -> Self { self.percent = percent; self }
    pub(super) fn bytes(mut self, current: Option<u64>, total: Option<u64>) -> Self { self.current_bytes = current; self.total_bytes = total; self }
    pub(super) fn version(mut self, version: Option<String>) -> Self { self.version = version; self }
    pub(super) fn message_opt(mut self, message: Option<String>) -> Self { self.message = message; self }
    pub(super) fn message(mut self, message: impl Into<String>) -> Self { self.message = Some(message.into()); self }
}

fn emit_progress(app_handle: &tauri::AppHandle, progress: Progress) {
    let Progress { target, phase, percent, current_bytes, total_bytes, version, message } = progress;
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

// Must run fully sequentially, never in parallel: the binaries share the same folder
// (~/.dischord/bin), and running them in parallel was producing corrupted binaries when
// the IDE auto-update killed the process in the middle of a concurrent download.
//   1. Editor (the IDE's own auto-update)
//   2. CLI ('chord')
//   3. Compiler
//   4. Embedded Node.js
//   5. Embedded pnpm
static SEQUENCE_RUNNING: AtomicBool = AtomicBool::new(false);

struct SequenceGuard;

impl Drop for SequenceGuard {
    fn drop(&mut self) {
        SEQUENCE_RUNNING.store(false, Ordering::SeqCst);
    }
}

pub fn run_full_update_sequence(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Reentrancy guard: refuse the request if a sequence is already running.
    if SEQUENCE_RUNNING.swap(true, Ordering::SeqCst) {
        return Err("Ya hay una actualización en curso. Espera a que termine.".into());
    }

    std::thread::spawn(move || {
        // Released on every exit path, including panics.
        let _guard = SequenceGuard;

        if let Err(e) = window::open_update_window(&app_handle) {
            error!("No se pudo abrir la ventana de actualización: {}", e);
        } else {
            // start the checks once the window can show them (bounded, so a window that never loads cannot stall updates).
            window::wait_update_window_ready(std::time::Duration::from_secs(10));
        }

        // 1. Editor
        tauri::async_runtime::block_on(run_ide_update(app_handle.clone()));

        // 2. CLI
        let cli_ready = cli::ensure_cli_updated(&app_handle);

        // 3. Compiler (only makes sense if the CLI ended up operational)
        if cli_ready {
            cli::update_compiler(&app_handle);
        } else {
            emit_progress(&app_handle, Progress::new("compiler", "error").message("No se pudo comprobar: la CLI no está disponible."));
        }

        // 4 and 5. Node.js and pnpm (ensure_runtime already does them in this order)
        runtime::ensure_runtime(app_handle);
    });
    Ok(())
}

#[tauri::command]
pub async fn start_full_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    run_full_update_sequence(app_handle)
}
