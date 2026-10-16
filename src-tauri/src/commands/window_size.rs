use serde::Serialize;
use tauri::Monitor;

const BASE_WIDTH: f64 = 800.0;
const BASE_HEIGHT: f64 = 600.0;
const REFERENCE_WIDTH: f64 = 1920.0;
const REFERENCE_HEIGHT: f64 = 1080.0;
const MIN_WIDTH: f64 = 640.0;
const MIN_HEIGHT: f64 = 480.0;
const MAX_WIDTH: f64 = 1100.0;
const MAX_HEIGHT: f64 = 825.0;

#[derive(Serialize, Clone, Copy)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

/// Sizes the main window in proportion to the monitor instead of always using 800x600.
pub fn compute_home_window_size(monitor: Option<Monitor>) -> WindowSize {
    let Some(monitor) = monitor else {
        return WindowSize { width: BASE_WIDTH, height: BASE_HEIGHT };
    };

    let scale = monitor.scale_factor();
    let logical_width = monitor.size().width as f64 / scale;
    let logical_height = monitor.size().height as f64 / scale;

    let width = (logical_width * (BASE_WIDTH / REFERENCE_WIDTH)).clamp(MIN_WIDTH, MAX_WIDTH);
    let height = (logical_height * (BASE_HEIGHT / REFERENCE_HEIGHT)).clamp(MIN_HEIGHT, MAX_HEIGHT);

    WindowSize { width, height }
}

#[tauri::command]
pub fn get_home_window_size(window: tauri::WebviewWindow) -> WindowSize {
    compute_home_window_size(window.current_monitor().ok().flatten())
}
