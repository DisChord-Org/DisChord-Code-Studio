use std::fs;
use std::path::Path;
use std::path::PathBuf;

use tauri::Manager;

use serde::Serialize;
use ignore::gitignore::GitignoreBuilder;
use log::{info, error, warn};

#[derive(Serialize)]
pub struct ProjectFile {
    name: String,
    is_dir: bool,
    relative_path: String,
    children: Option<Vec<ProjectFile>>,
}

fn get_workflow_path(app_handle: &tauri::AppHandle, project_name: &str) -> PathBuf {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path
}

#[tauri::command]
pub fn read_project_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    let root_path = get_workflow_path(&app_handle, &name);
    info!("Escaneando archivos del proyecto: {:?}", root_path);
    
    let root_str = root_path.to_string_lossy().to_string();
    let mut builder = GitignoreBuilder::new(&root_path);

    let gitignore_path = root_path.join(".gitignore");
    if gitignore_path.exists() {
        let _ = builder.add(&gitignore_path);
        info!("Se encontró .gitignore, aplicando filtros");
    }

    let matcher = builder.build().map_err(|e| {
        error!("Error al construir el matcher de gitignore: {}", e);
        e.to_string()
    })?;

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

    let result = scan_dir(&root_path, &root_str, &matcher);
    info!("Escaneo completado con éxito para '{}'", name);
    Ok(result)
}

#[tauri::command]
pub fn read_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String) -> Result<String, String> {
    let mut path = get_workflow_path(&app_handle, &project_name);
    path.push(&file_path);

    info!("Leyendo contenido: {:?}", file_path);
    fs::read_to_string(&path).map_err(|e| {
        error!("Error leyendo archivo {:?}: {}", path, e);
        format!("No se pudo leer el archivo: {}", e)
    })
}

#[tauri::command]
pub fn save_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String, content: String) -> Result<String, String> {
    let mut path = get_workflow_path(&app_handle, &project_name);
    path.push(&file_path);

    fs::write(&path, content).map_err(|e| {
        error!("Error al guardar archivo {:?}: {}", path, e);
        format!("Error al guardar: {}", e)
    })?;
    
    info!("Archivo guardado correctamente: {:?}", file_path);
    Ok("Archivo guardado".into())
}

#[tauri::command]
pub fn create_new_file(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let mut path = get_workflow_path(&app_handle, &project_name);
    path.push(parent_path);
    path.push(&name);

    if path.exists() {
        warn!("Intento de crear archivo ya existente: {:?}", path);
        return Err("El archivo ya existe".into());
    }

    fs::write(&path, "").map_err(|e| {
        error!("Fallo al crear archivo {:?}: {}", path, e);
        format!("Error al crear el archivo: {}", e)
    })?;

    info!("Nuevo archivo creado: {:?}", name);
    Ok("Archivo creado".into())
}

#[tauri::command]
pub fn create_new_folder(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let mut path = get_workflow_path(&app_handle, &project_name);
    path.push(parent_path);
    path.push(&name);

    if path.exists() {
        warn!("Intento de crear carpeta ya existente: {:?}", path);
        return Err("La carpeta ya existe".into());
    }

    fs::create_dir_all(&path).map_err(|e| {
        error!("Fallo al crear carpeta {:?}: {}", path, e);
        format!("Error al crear la carpeta: {}", e)
    })?;

    info!("Nueva carpeta creada: {:?}", name);
    Ok("Carpeta creada".into())
}

#[tauri::command]
pub fn delete_item(app_handle: tauri::AppHandle, project_name: String, path: String) -> Result<String, String> {
    let mut full_path = get_workflow_path(&app_handle, &project_name);
    full_path.push(&path);

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

    res.map_err(|e| {
        error!("Error al eliminar {:?}: {}", full_path, e);
        e.to_string()
    })?;

    Ok("Eliminado correctamente".into())
}