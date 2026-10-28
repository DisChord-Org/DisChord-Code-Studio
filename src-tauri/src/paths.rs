use std::path::{Component, Path, PathBuf};

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

/// True when `relative` stays under its base: only plain names, no `..`, root or drive prefix.
pub fn is_inside_project(relative: &str) -> bool {
    Path::new(relative)
        .components()
        .all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

/// Resolves `relative` under the project, rejecting names or paths that would escape it.
pub fn resolve_in_project(app_handle: &tauri::AppHandle, project_name: &str, relative: &str) -> Result<PathBuf, String> {
    let single_name = Path::new(project_name).components().count() == 1;
    if project_name.is_empty() || !single_name || !is_inside_project(project_name) || !is_inside_project(relative) {
        return Err("Ruta no válida.".into());
    }
    Ok(project_path(app_handle, project_name).join(relative))
}
