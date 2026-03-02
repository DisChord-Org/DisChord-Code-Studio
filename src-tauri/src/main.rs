// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use tauri::Manager;
use std::process::Command;
use serde::Serialize;

#[tauri::command]
fn create_projects_folder(app_handle: tauri::AppHandle) -> String {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");

    if !path.exists() {
        fs::create_dir_all(&path).unwrap();
    }
    "done".into()
}

#[tauri::command]
fn get_projects(app_handle: tauri::AppHandle) -> Vec<String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");

    let mut projects = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        projects.push(name.to_string());
                    }
                }
            }
        }
    }
    projects
}

#[tauri::command]
fn create_new_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let chord_check = Command::new("chord")
        .arg("-v")
        .output();

    if chord_check.is_err() {
        return Err("El comando 'chord' no está instalado en tu sistema Debian.".into());
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

#[derive(Serialize)]
struct ProjectFile {
    name: String,
    is_dir: bool,
    relative_path: String,
    children: Option<Vec<ProjectFile>>,
}

#[tauri::command]
fn read_project_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    let mut root_path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    root_path.push("DisChord-Workflows");
    root_path.push(&name);
    let root_str = root_path.to_string_lossy().to_string();

    fn scan_dir(path: &std::path::Path, root_str: &str) -> Vec<ProjectFile> {
        let mut files = Vec::new();
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                let is_dir = file_path.is_dir();
                
                let relative_path = file_path.to_string_lossy()
                    .replace(root_str, "")
                    .trim_start_matches('/')
                    .to_string();

                files.push(ProjectFile {
                    name: entry.file_name().to_string_lossy().to_string(),
                    is_dir,
                    relative_path,
                    children: if is_dir { Some(scan_dir(&file_path, root_str)) } else { None },
                });
            }
        }
        files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir));
        files
    }

    Ok(scan_dir(&root_path, &root_str))
}

#[tauri::command]
fn read_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(file_path);

    fs::read_to_string(&path).map_err(|e| format!("No se pudo leer el archivo: {}", e))
}

#[tauri::command]
fn save_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String, content: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(file_path);

    fs::write(&path, content).map_err(|e| format!("Error al guardar: {}", e))?;
    Ok("Archivo guardado".into())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_projects_folder,
            get_projects,
            create_new_project,
            read_project_files,
            read_file_content,
            save_file_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    dischord_code_studio_lib::run()
}