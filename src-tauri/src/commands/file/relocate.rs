use std::fs;
use std::path::Path;

use log::info;

use crate::paths::{is_inside_project, resolve_in_project};
use crate::log_err::LogErr;

const INVALID_NAME_CHARS: &[char] = &['/', '\\', '<', '>', ':', '"', '|', '?', '*', '\0'];

fn validate_item_name(name: &str) -> Result<&str, String> {
    let name = name.trim();

    if name.is_empty() || name == "." || name == ".." {
        return Err("El nombre no es válido.".into());
    }
    if name.contains(INVALID_NAME_CHARS) {
        return Err("El nombre no puede contener / \\ < > : \" | ? *".into());
    }

    Ok(name)
}

fn relocate(root: &Path, from: &str, target_dir: &str, new_name: &str) -> Result<String, String> {
    let new_name = validate_item_name(new_name)?;

    if from.is_empty() || !is_inside_project(from) || !is_inside_project(target_dir) {
        return Err("Ruta no válida.".into());
    }

    let source = root.join(from);
    let destination_dir = root.join(target_dir);
    let destination = destination_dir.join(new_name);
    let new_relative = Path::new(target_dir).join(new_name).to_string_lossy().replace('\\', "/");

    if !source.exists() {
        return Err("El elemento no existe.".into());
    }
    if !destination_dir.is_dir() {
        return Err("La carpeta de destino no existe.".into());
    }
    if destination == source {
        return Ok(new_relative);
    }
    if source.is_dir() && destination_dir.starts_with(&source) {
        return Err("No se puede mover una carpeta dentro de sí misma.".into());
    }

    let same_file = destination.exists() && fs::canonicalize(&destination).ok() == fs::canonicalize(&source).ok();
    if destination.exists() && !same_file {
        return Err(format!("Ya existe «{}» en ese destino.", new_name));
    }

    fs::rename(&source, &destination).log_err(&format!("No se pudo mover {:?} a {:?}", source, destination))?;

    info!("Movido {:?} -> {:?}", from, new_relative);
    Ok(new_relative)
}

#[tauri::command]
pub fn rename_item(app_handle: tauri::AppHandle, project_name: String, path: String, new_name: String) -> Result<String, String> {
    let root = resolve_in_project(&app_handle, &project_name, "")?;
    let parent = Path::new(&path).parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();

    relocate(&root, &path, &parent, &new_name)
}

#[tauri::command]
pub fn move_item(app_handle: tauri::AppHandle, project_name: String, path: String, target_dir: String) -> Result<String, String> {
    let root = resolve_in_project(&app_handle, &project_name, "")?;
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("Ruta no válida.")?;

    relocate(&root, &path, &target_dir, &name)
}
