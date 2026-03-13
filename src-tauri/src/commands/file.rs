use std::fs;
use std::path::Path;

use tauri::Manager;

use serde::Serialize;
use ignore::gitignore::GitignoreBuilder;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};

#[tauri::command]
pub fn read_project_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    let mut root_path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    root_path.push("DisChord-Workflows");
    root_path.push(&name);
    
    let root_str = root_path.to_string_lossy().to_string();
    let mut builder = GitignoreBuilder::new(&root_path);
    let gitignore_path = root_path.join(".gitignore");
    if gitignore_path.exists() {
        let _ = builder.add(&gitignore_path);
    }
    let matcher = builder.build().unwrap();

    fn scan_dir(path: &Path, root_str: &str, matcher: &ignore::gitignore::Gitignore) -> Vec<ProjectFile> {
        let mut files = Vec::new();

        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if file_name == ".gitignore" || file_name == ".git" {
                    continue;
                }

                if matcher.matched(&file_path, file_path.is_dir()).is_ignore() {
                    continue;
                }

                let is_dir = file_path.is_dir();
                let relative_path = file_path.to_string_lossy()
                    .replace(root_str, "")
                    .trim_start_matches(|c| c == '/' || c == '\\')
                    .to_string();

                files.push(ProjectFile {
                    name: file_name,
                    is_dir,
                    relative_path,
                    children: if is_dir { 
                        Some(scan_dir(&file_path, root_str, matcher)) 
                    } else { 
                        None 
                    },
                });
            }
        }

        files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
        files
    }

    Ok(scan_dir(&root_path, &root_str, &matcher))
}

#[derive(Serialize)]
pub struct ProjectFile {
    name: String,
    is_dir: bool,
    relative_path: String,
    children: Option<Vec<ProjectFile>>,
}

#[tauri::command]
pub fn read_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(file_path);

    fs::read_to_string(&path).map_err(|e| format!("No se pudo leer el archivo: {}", e))
}

#[tauri::command]
pub fn save_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String, content: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(file_path);

    fs::write(&path, content).map_err(|e| format!("Error al guardar: {}", e))?;
    Ok("Archivo guardado".into())
}

#[tauri::command]
pub fn create_new_file(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(parent_path);
    path.push(name);

    if path.exists() {
        return Err("El archivo ya existe".into());
    }

    fs::write(&path, "").map_err(|e| format!("Error al crear el archivo: {}", e))?;
    Ok("Archivo creado".into())
}

#[tauri::command]
pub fn create_new_folder(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(parent_path);
    path.push(name);

    if path.exists() {
        return Err("La carpeta ya existe".into());
    }

    fs::create_dir_all(&path).map_err(|e| format!("Error al crear la carpeta: {}", e))?;
    Ok("Carpeta creada".into())
}

#[tauri::command]
pub fn delete_item(app_handle: tauri::AppHandle, project_name: String, path: String) -> Result<String, String> {
    let mut full_path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    full_path.push("DisChord-Workflows");
    full_path.push(project_name);
    full_path.push(path);

    if !full_path.exists() {
        return Err("El elemento no existe".into());
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    }

    Ok("Eliminado correctamente".into())
}