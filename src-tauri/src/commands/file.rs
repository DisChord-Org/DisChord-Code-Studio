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

pub(crate) fn build_gitignore_matcher(root_path: &Path) -> Result<Gitignore, String> {
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

const INVALID_NAME_CHARS: &[char] = &['/', '\\', '<', '>', ':', '"', '|', '?', '*', '\0'];

/// A single file or folder name: not empty, not "."/"..", and without separators or characters
/// that are invalid on some platform (projects get shared between systems).
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

/// A path relative to the project that cannot climb out of it.
fn is_inside_project(relative: &str) -> bool {
    Path::new(relative)
        .components()
        .all(|c| matches!(c, std::path::Component::Normal(_) | std::path::Component::CurDir))
}

/// Moves `from` (relative to `root`) into the folder `target_dir`, calling it `new_name`.
/// Returns the new relative path.
fn relocate(root: &Path, from: &str, target_dir: &str, new_name: &str) -> Result<String, String> {
    let new_name = validate_item_name(new_name)?;

    if from.is_empty() || !is_inside_project(from) || !is_inside_project(target_dir) {
        return Err("Ruta no válida.".into());
    }

    let source = root.join(from);
    let destination_dir = root.join(target_dir);
    let destination = destination_dir.join(new_name);
    let new_relative = Path::new(target_dir).join(new_name).to_string_lossy().to_string();

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

    // On case-insensitive file systems "a.txt" -> "A.txt" "exists" already, but it is the same file.
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
    let root = project_path(&app_handle, &project_name);
    let parent = Path::new(&path).parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();

    relocate(&root, &path, &parent, &new_name)
}

#[tauri::command]
pub fn move_item(app_handle: tauri::AppHandle, project_name: String, path: String, target_dir: String) -> Result<String, String> {
    let root = project_path(&app_handle, &project_name);
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("Ruta no válida.")?;

    relocate(&root, &path, &target_dir, &name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_project(label: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("dischord-file-tests-{}-{}", label, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("src/commands")).unwrap();
        fs::write(root.join("src/index.chord"), "x").unwrap();
        fs::write(root.join("src/commands/ping.chord"), "y").unwrap();
        fs::create_dir_all(root.join("lib")).unwrap();
        root
    }

    #[test]
    fn renames_a_file_in_place() {
        let root = scratch_project("rename");
        let moved = relocate(&root, "src/index.chord", "src", "main.chord").unwrap();

        assert_eq!(moved, Path::new("src").join("main.chord").to_string_lossy());
        assert!(root.join("src/main.chord").exists());
        assert!(!root.join("src/index.chord").exists());
    }

    #[test]
    fn moves_a_folder_with_its_content() {
        let root = scratch_project("move");
        relocate(&root, "src/commands", "lib", "commands").unwrap();

        assert!(root.join("lib/commands/ping.chord").exists());
        assert!(!root.join("src/commands").exists());
    }

    #[test]
    fn moves_to_the_project_root() {
        let root = scratch_project("root");
        let moved = relocate(&root, "src/index.chord", "", "index.chord").unwrap();

        assert_eq!(moved, "index.chord");
        assert!(root.join("index.chord").exists());
    }

    #[test]
    fn refuses_to_move_a_folder_into_itself() {
        let root = scratch_project("self");

        assert!(relocate(&root, "src", "src/commands", "src").is_err());
        assert!(root.join("src/commands/ping.chord").exists());
    }

    #[test]
    fn refuses_to_overwrite() {
        let root = scratch_project("overwrite");
        fs::write(root.join("lib/index.chord"), "z").unwrap();

        assert!(relocate(&root, "src/index.chord", "lib", "index.chord").is_err());
        assert_eq!(fs::read_to_string(root.join("lib/index.chord")).unwrap(), "z");
    }

    #[test]
    fn refuses_paths_that_leave_the_project() {
        let root = scratch_project("escape");

        assert!(relocate(&root, "../outside", "src", "x").is_err());
        assert!(relocate(&root, "src/index.chord", "../..", "index.chord").is_err());
        assert!(relocate(&root, "src/index.chord", "src", "../evil").is_err());
        assert!(relocate(&root, "src/index.chord", "src", "a/b").is_err());
    }

    #[test]
    fn keeping_the_same_place_is_a_no_op() {
        let root = scratch_project("noop");

        assert!(relocate(&root, "src/index.chord", "src", "index.chord").is_ok());
        assert!(root.join("src/index.chord").exists());
    }
}
