use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const EVENT: &str = "terminal-output";

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LineKind {
    /// What the program writes to stdout.
    Stdout,
    /// What the program writes to stderr.
    Stderr,
    /// A neutral message from the IDE.
    Info,
    Success,
    Warning,
}

#[derive(Clone, Copy, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum RunStatus {
    Finished,
    /// The process exited with an error; `code` is missing when it was killed by a signal.
    Failed { code: Option<i32> },
    Stopped,
}

/// What the "Salida" tab receives through the "terminal-output" event.
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OutputEvent {
    Line { kind: LineKind, text: String, ts: u64 },
    RunEnd { status: RunStatus, ts: u64 },
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn emit_line(app_handle: &AppHandle, kind: LineKind, text: impl Into<String>) {
    let _ = app_handle.emit(EVENT, OutputEvent::Line { kind, text: text.into(), ts: now_ms() });
}

pub fn emit_run_end(app_handle: &AppHandle, status: RunStatus) {
    let _ = app_handle.emit(EVENT, OutputEvent::RunEnd { status, ts: now_ms() });
}
