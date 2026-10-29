use std::path::{Component, Path, PathBuf};

use tauri::Manager;

const WORKFLOWS_DIR_NAME: &str = "DisChord-Workflows";

pub fn workflows_root(app_handle: &tauri::AppHandle) -> PathBuf {
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

pub fn is_inside_project(relative: &str) -> bool {
    Path::new(relative)
        .components()
        .all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

fn escapes_root(root: &Path, full: &Path) -> bool {
    let Ok(root) = root.canonicalize() else { return false };
    let Some(existing) = full.ancestors().find(|p| p.exists()) else { return false };
    match existing.canonicalize() {
        Ok(resolved) => !resolved.starts_with(&root),
        Err(_) => true,
    }
}

pub fn resolve_in_project(app_handle: &tauri::AppHandle, project_name: &str, relative: &str) -> Result<PathBuf, String> {
    let single_name = Path::new(project_name).components().count() == 1;
    if project_name.is_empty() || !single_name || !is_inside_project(project_name) || !is_inside_project(relative) {
        return Err("Ruta no válida.".into());
    }

    let root = project_path(app_handle, project_name);
    let full = root.join(relative);
    if escapes_root(&root, &full) {
        return Err("Ruta no válida.".into());
    }
    Ok(full)
}
