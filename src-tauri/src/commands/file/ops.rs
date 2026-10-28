use std::fs;
use std::path::{Path, PathBuf};

use log::{info, error, warn};

use crate::{DiscordState, update_presence};
use crate::paths::resolve_in_project;
use crate::log_err::LogErr;

fn item_path(app_handle: &tauri::AppHandle, project_name: &str, relative: impl AsRef<Path>) -> Result<PathBuf, String> {
    resolve_in_project(app_handle, project_name, &relative.as_ref().to_string_lossy())
}

#[tauri::command]
pub fn read_file_content(app_handle: tauri::AppHandle, discord: tauri::State<'_, DiscordState>, project_name: String, file_path: String) -> Result<String, String> {
    let path = item_path(&app_handle, &project_name, &file_path)?;

    let file_name = Path::new(&file_path)
        .file_name()
        .and_then(|os_str| os_str.to_str())
        .unwrap_or(&file_path);

    let _ = update_presence(
        &discord.client,
        &format!("Proyecto: {}", project_name),
        &format!("Editando {}", file_name)
    );

    info!("Leyendo contenido: {:?}", file_path);
    fs::read_to_string(&path).log_err(&format!("No se pudo leer el archivo {:?}", path))
}

#[tauri::command]
pub fn save_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String, content: String) -> Result<String, String> {
    let path = item_path(&app_handle, &project_name, &file_path)?;

    fs::write(&path, content).log_err(&format!("Error al guardar archivo {:?}", path))?;

    info!("Archivo guardado correctamente: {:?}", file_path);
    Ok("Archivo guardado".into())
}

#[tauri::command]
pub fn create_new_file(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let path = item_path(&app_handle, &project_name, Path::new(&parent_path).join(&name))?;

    if path.exists() {
        warn!("Intento de crear archivo ya existente: {:?}", path);
        return Err("El archivo ya existe".into());
    }

    fs::write(&path, "").log_err(&format!("Fallo al crear archivo {:?}", path))?;

    info!("Nuevo archivo creado: {:?}", name);
    Ok("Archivo creado".into())
}

#[tauri::command]
pub fn create_new_folder(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let path = item_path(&app_handle, &project_name, Path::new(&parent_path).join(&name))?;

    if path.exists() {
        warn!("Intento de crear carpeta ya existente: {:?}", path);
        return Err("La carpeta ya existe".into());
    }

    fs::create_dir_all(&path).log_err(&format!("Fallo al crear carpeta {:?}", path))?;

    info!("Nueva carpeta creada: {:?}", name);
    Ok("Carpeta creada".into())
}

#[tauri::command]
pub fn delete_item(app_handle: tauri::AppHandle, project_name: String, path: String) -> Result<String, String> {
    let full_path = item_path(&app_handle, &project_name, &path)?;

    if !full_path.exists() {
        error!("Intento de borrar elemento inexistente: {:?}", full_path);
        return Err("El elemento no existe".into());
    }

    let res = if full_path.is_dir() {
        info!("Eliminando carpeta completa: {:?}", full_path);
        fs::remove_dir_all(&full_path)
    } else {
        info!("Eliminando archivo: {:?}", full_path);
        fs::remove_file(&full_path)
    };

    res.log_err(&format!("Error al eliminar {:?}", full_path))?;

    Ok("Eliminado correctamente".into())
}
