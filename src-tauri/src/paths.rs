use std::path::PathBuf;

use tauri::Manager;

const WORKFLOWS_DIR_NAME: &str = "DisChord-Workflows";

pub fn workflows_root(app_handle: &tauri::AppHandle) -> PathBuf {
    // Fall back to the current dir (or ".") so a missing documents dir never panics.
    let mut path = app_handle
        .path()
        .document_dir()
        .or_else(|_| std::env::current_dir())
        .unwrap_or_else(|_| PathBuf::from("."));
    path.push(WORKFLOWS_DIR_NAME);
    path
}

pub fn project_path(app_handle: &tauri::AppHandle, project_name: &str) -> PathBuf {
    let mut path = workflows_root(app_handle);
    path.push(project_name);
    path
}
