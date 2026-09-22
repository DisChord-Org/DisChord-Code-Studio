use serde::Serialize;
use tauri::Monitor;

// Target window width on a REFERENCE_WIDTH x REFERENCE_HEIGHT monitor.
const BASE_WIDTH: f64 = 800.0;
// Target window height on a REFERENCE_WIDTH x REFERENCE_HEIGHT monitor.
const BASE_HEIGHT: f64 = 600.0;
// Logical width of the monitor BASE_WIDTH/BASE_HEIGHT were tuned against (a typical 1080p desktop display).
const REFERENCE_WIDTH: f64 = 1920.0;
// Logical height of the monitor BASE_WIDTH/BASE_HEIGHT were tuned against (a typical 1080p desktop display).
const REFERENCE_HEIGHT: f64 = 1080.0;
// Smallest allowed window width, regardless of how small the monitor is.
const MIN_WIDTH: f64 = 640.0;
// Smallest allowed window height, regardless of how small the monitor is.
const MIN_HEIGHT: f64 = 480.0;
// Largest allowed window width, regardless of how large the monitor is.
const MAX_WIDTH: f64 = 1100.0;
// Largest allowed window height, regardless of how large the monitor is.
const MAX_HEIGHT: f64 = 825.0;

#[derive(Serialize, Clone, Copy)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

// calculates the size of the main window like a monitor frame instead of use always 800x600
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
