use std::path::PathBuf;

use tauri::Manager;

pub fn workflows_root(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path
}

pub fn project_path(app_handle: &tauri::AppHandle, project_name: &str) -> PathBuf {
    let mut path = workflows_root(app_handle);
    path.push(project_name);
    path
}
