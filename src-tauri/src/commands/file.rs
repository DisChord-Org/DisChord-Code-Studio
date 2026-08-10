use std::fs;
use std::path::Path;

use serde::Serialize;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use log::{info, error, warn};

use crate::{DiscordState, update_presence};
use crate::paths::project_path;
use crate::log_err::LogErr;

#[derive(Serialize)]
pub struct ProjectFile {
    name: String,
    is_dir: bool,
    relative_path: String,
    children: Option<Vec<ProjectFile>>,
}

fn build_gitignore_matcher(root_path: &Path) -> Result<Gitignore, String> {
    let mut builder = GitignoreBuilder::new(root_path);

    let gitignore_path = root_path.join(".gitignore");
    if gitignore_path.exists() {
        let _ = builder.add(&gitignore_path);
    }

    builder.build().log_err("Error al construir el matcher de gitignore")
}

#[tauri::command]
pub fn read_project_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    let root_path = project_path(&app_handle, &name);
    info!("Escaneando archivos del proyecto: {:?}", root_path);

    let root_str = root_path.to_string_lossy().to_string();
    let matcher = build_gitignore_matcher(&root_path)?;

    fn scan_dir(path: &Path, root_str: &str, matcher: &Gitignore) -> Vec<ProjectFile> {
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

/// Lista los ficheros (no carpetas) que el .gitignore del proyecto oculta,
/// para poder editarlos desde el menú "Editar > Ficheros ocultos" aunque
/// no aparezcan en el árbol normal del explorador.
#[tauri::command]
pub fn read_hidden_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    let root_path = project_path(&app_handle, &name);
    info!("Escaneando ficheros ocultos del proyecto: {:?}", root_path);

    let root_str = root_path.to_string_lossy().to_string();
    let matcher = build_gitignore_matcher(&root_path)?;

    fn collect_hidden(path: &Path, root_str: &str, matcher: &Gitignore, out: &mut Vec<ProjectFile>) {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if file_name == ".gitignore" || file_name == ".git" || file_name == "node_modules" {
                    continue;
                }

                let is_dir = file_path.is_dir();

                if !is_dir && matcher.matched(&file_path, false).is_ignore() {
                    let relative_path = file_path.to_string_lossy()
                        .replace(root_str, "")
                        .trim_start_matches(|c| c == '/' || c == '\\')
                        .to_string();

                    out.push(ProjectFile {
                        name: file_name,
                        is_dir: false,
                        relative_path,
                        children: None,
                    });
                }

                if is_dir {
                    collect_hidden(&file_path, root_str, matcher, out);
                }
            }
        }
    }

    let mut hidden = Vec::new();
    collect_hidden(&root_path, &root_str, &matcher, &mut hidden);
    hidden.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(hidden)
}

#[tauri::command]
pub fn read_file_content(app_handle: tauri::AppHandle, discord: tauri::State<'_, DiscordState>, project_name: String, file_path: String) -> Result<String, String> {
    let mut path = project_path(&app_handle, &project_name);
    path.push(&file_path);

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
    let mut path = project_path(&app_handle, &project_name);
    path.push(&file_path);

    fs::write(&path, content).log_err(&format!("Error al guardar archivo {:?}", path))?;

    info!("Archivo guardado correctamente: {:?}", file_path);
    Ok("Archivo guardado".into())
}

#[tauri::command]
pub fn create_new_file(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let mut path = project_path(&app_handle, &project_name);
    path.push(parent_path);
    path.push(&name);

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
    let mut path = project_path(&app_handle, &project_name);
    path.push(parent_path);
    path.push(&name);

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
    let mut full_path = project_path(&app_handle, &project_name);
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

    res.log_err(&format!("Error al eliminar {:?}", full_path))?;

    Ok("Eliminado correctamente".into())
}
