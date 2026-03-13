use std::fs;
use std::time::SystemTime;
use std::path::Path;
use std::process::Command;

use tauri::Manager;

use serde::Serialize;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};

#[tauri::command]
pub fn create_projects_folder(app_handle: tauri::AppHandle) -> String {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");

    if !path.exists() {
        fs::create_dir_all(&path).unwrap();
    }
    "done".into()
}

#[derive(Serialize)]
pub struct ProjectInfo {
    name: String,
    last_modified: String,
}

pub fn get_latest_modification(path: &Path) -> SystemTime {
    let mut latest = fs::metadata(path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
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
    let mut root_path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    root_path.push("DisChord-Workflows");

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
    }
    
    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    projects
}

#[tauri::command]
pub fn create_new_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let chord_check = Command::new("chord")
        .arg("-v")
        .output();

    if chord_check.is_err() {
        return Err("El comando 'chord' no está instalado en tu sistema.".into());
    }

    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(&name);

    if path.exists() {
        return Err("El proyecto ya existe".into());
    }

    // se supone que 'chord init <path>' ya crea la carpeta, próximamente será necesario usar esto 
    /*if let Err(e) = fs::create_dir_all(&path) {
        return Err(format!("Error al crear la carpeta: {}", e));
    }*/

    let init_status = Command::new("chord")
        .arg("init")
        .arg(&path)
        .status();

    match init_status {
        Ok(s) if s.success() => Ok(format!("Proyecto '{}' creado", name)),
        Ok(_) => Err("'chord init' falló. Revisa los permisos de la carpeta.".into()),
        Err(e) => Err(format!("Error al ejecutar chord init: {}", e)),
    }
}

#[tauri::command]
pub fn delete_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(&name);

    if path.exists() && path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| format!("Error al borrar proyecto: {}", e))?;
        Ok("Proyecto eliminado".into())
    } else {
        Err("El proyecto no existe".into())
    }
}