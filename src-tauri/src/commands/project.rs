use std::fs;
use std::time::SystemTime;
use std::path::Path;
use std::path::PathBuf;
use std::process::Command;

use tauri::Manager;

use serde::Serialize;
use log::{info, error, warn, debug};

#[derive(Serialize)]
pub struct ProjectInfo {
    name: String,
    last_modified: String,
}

fn get_base_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path
}

#[tauri::command]
pub fn create_projects_folder(app_handle: tauri::AppHandle) -> String {
    let path = get_base_path(&app_handle);

    if !path.exists() {
        info!("Directorio base no encontrado. Creando: {:?}", path);
        if let Err(e) = fs::create_dir_all(&path) {
            error!("No se pudo crear el directorio base: {}", e);
            return "error".into();
        }
    }
    "done".into()
}

pub fn get_latest_modification(path: &Path) -> SystemTime {
    let mut latest = fs::metadata(path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();

            if entry_path.is_dir() && entry_path.ends_with("node_modules") {
                continue;
            }

            let mtime = if entry_path.is_dir() {
                get_latest_modification(&entry_path)
            } else {
                fs::metadata(&entry_path)
                    .and_then(|m| m.modified())
                    .unwrap_or(SystemTime::UNIX_EPOCH)
            };

            if mtime > latest {
                latest = mtime;
            }
        }
    }
    latest
}

#[tauri::command]
pub fn get_projects(app_handle: tauri::AppHandle) -> Vec<ProjectInfo> {
    let root_path = get_base_path(&app_handle);
    debug!("Listando proyectos desde: {:?}", root_path);

    let mut projects = Vec::new();

    if let Ok(entries) = fs::read_dir(root_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                let last_modified_time = get_latest_modification(&path);
                let datetime: chrono::DateTime<chrono::Local> = last_modified_time.into();
                let formatted_time = datetime.to_rfc3339(); 

                projects.push(ProjectInfo {
                    name,
                    last_modified: formatted_time,
                });
            }
        }
    } else {
        warn!("No se pudo leer el directorio de proyectos");
    }
    
    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    projects
}

#[tauri::command]
pub fn create_new_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    info!("Solicitud de creación de proyecto: {}", name);
    
    let chord_check = Command::new("chord")
        .arg("-v")
        .output();

    if let Err(e) = chord_check {
        error!("El comando 'chord' falló o no está en el PATH: {}", e);
        return Err("El motor 'chord' no está listo. Revisa la configuración.".into());
    }

    let mut path = get_base_path(&app_handle);
    path.push(&name);

    if path.exists() {
        warn!("El proyecto '{}' ya existe en {:?}", name, path);
        return Err("El proyecto ya existe".into());
    }

    info!("Ejecutando 'chord init' para el proyecto: {}", name);
    let init_status = Command::new("chord")
        .arg("init")
        .arg(&path)
        .status();

    match init_status {
        Ok(s) if s.success() => {
            info!("Proyecto '{}' creado exitosamente", name);
            Ok(format!("Proyecto '{}' creado", name))
        },
        Ok(s) => {
            error!("'chord init' terminó con código de error: {}", s);
            Err("'chord init' falló. Revisa los permisos.".into())
        },
        Err(e) => {
            error!("Fallo fatal ejecutando 'chord init': {}", e);
            Err(format!("Error de ejecución: {}", e))
        },
    }
}

#[tauri::command]
pub fn delete_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let mut path = get_base_path(&app_handle);
    path.push(&name);

    if path.exists() && path.is_dir() {
        info!("Eliminando proyecto completo: {:?}", path);
        fs::remove_dir_all(&path).map_err(|e| {
            error!("No se pudo borrar el proyecto {}: {}", name, e);
            format!("Error al borrar: {}", e)
        })?;
        info!("Proyecto '{}' eliminado.", name);
        Ok("Proyecto eliminado".into())
    } else {
        error!("Intento de borrar proyecto inexistente: {}", name);
        Err("El proyecto no existe".into())
    }
}