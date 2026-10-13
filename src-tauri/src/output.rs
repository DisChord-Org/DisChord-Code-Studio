use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const EVENT: &str = "terminal-output";

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LineKind {
    Stdout,
    Stderr,
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Clone, Serialize)]
pub struct Location {
    pub path: String,
    pub line: u32,
    pub column: u32,
}

#[derive(Clone, Copy, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum RunStatus {
    Finished,
    Failed { code: Option<i32> },
    Stopped,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OutputEvent {
    Line {
        kind: LineKind,
        text: String,
        ts: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        location: Option<Location>,
    },
    RunEnd { status: RunStatus, ts: u64 },
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn emit_line(app_handle: &AppHandle, kind: LineKind, text: impl Into<String>) {
    let _ = app_handle.emit(EVENT, OutputEvent::Line { kind, text: text.into(), ts: now_ms(), location: None });
}

pub fn emit_located_line(app_handle: &AppHandle, kind: LineKind, text: impl Into<String>, location: Option<Location>) {
    let _ = app_handle.emit(EVENT, OutputEvent::Line { kind, text: text.into(), ts: now_ms(), location });
}

pub fn emit_run_end(app_handle: &AppHandle, status: RunStatus) {
    let _ = app_handle.emit(EVENT, OutputEvent::RunEnd { status, ts: now_ms() });
}
