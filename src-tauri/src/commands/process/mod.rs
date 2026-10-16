mod explorer;
mod install;
mod run;
mod stream;

use tauri::State;

use crate::ChildProcessState;

pub use run::kill_run;

#[tauri::command]
pub fn run_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>, project_name: String) -> Result<(), String> {
    run::start(app_handle, &state, project_name)
}

#[tauri::command]
pub fn stop_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>) -> Result<String, String> {
    run::stop(&app_handle, &state)
}

#[tauri::command]
pub fn open_in_explorer(app_handle: tauri::AppHandle, project_name: String) -> Result<(), String> {
    explorer::open_project(&app_handle, &project_name)
}

#[tauri::command]
pub fn open_logs_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    explorer::open_logs(&app_handle)
}

#[tauri::command]
pub fn open_app_data_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    explorer::open_app_data(&app_handle)
}

#[tauri::command]
pub fn open_binaries_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    explorer::open_binaries(&app_handle)
}
