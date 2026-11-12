mod explorer;
mod install;
mod run;
mod stream;

use tauri::State;

use crate::ChildProcessState;

pub use run::kill_run;

#[tauri::command]
pub async fn run_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>, project_name: String) -> Result<(), String> {
    let run = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || run::start(app_handle, run, project_name))
        .await
        .map_err(|e| format!("La tarea de ejecución falló: {}", e))?
}

#[tauri::command]
pub async fn stop_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>) -> Result<String, String> {
    let run = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || run::stop(&app_handle, &run))
        .await
        .map_err(|e| format!("La tarea de detención falló: {}", e))?
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
