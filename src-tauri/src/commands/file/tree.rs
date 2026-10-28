use std::fs;
use std::path::Path;

use serde::Serialize;
use ignore::gitignore::Gitignore;
use log::info;

use crate::paths::project_path;
use super::gitignore::{build_gitignore_matcher, GITIGNORE_FILE};

#[derive(Serialize)]
pub struct ProjectFile {
    name: String,
    is_dir: bool,
    relative_path: String,
    children: Option<Vec<ProjectFile>>,
}

fn to_relative(file: &Path, root: &str) -> String {
    file.to_string_lossy()
        .replace(root, "")
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string()
}

const GIT_DIR: &str = ".git";
const DEPENDENCIES_DIR: &str = "node_modules";

fn scan_dir(path: &Path, root_str: &str, matcher: &Gitignore) -> Vec<ProjectFile> {
    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if file_name == GITIGNORE_FILE || file_name == GIT_DIR {
                continue;
            }

            let is_dir = file_path.is_dir();
            if matcher.matched(&file_path, is_dir).is_ignore() {
                continue;
            }

            files.push(ProjectFile {
                name: file_name,
                is_dir,
                relative_path: to_relative(&file_path, root_str),
                children: is_dir.then(|| scan_dir(&file_path, root_str, matcher)),
            });
        }
    }

    files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    files
}

/// Files that the `.gitignore` hides from the tree, found at any depth (folders are walked, never listed).
fn collect_hidden(path: &Path, root_str: &str, matcher: &Gitignore, out: &mut Vec<ProjectFile>) {
    let Ok(entries) = fs::read_dir(path) else { return };

    for entry in entries.flatten() {
        let file_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if file_name == GITIGNORE_FILE || file_name == GIT_DIR || file_name == DEPENDENCIES_DIR {
            continue;
        }

        if file_path.is_dir() {
            collect_hidden(&file_path, root_str, matcher, out);
        } else if matcher.matched(&file_path, false).is_ignore() {
            out.push(ProjectFile {
                name: file_name,
                is_dir: false,
                relative_path: to_relative(&file_path, root_str),
                children: None,
            });
        }
    }
}

#[tauri::command]
pub fn read_project_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    let root_path = project_path(&app_handle, &name);
    info!("Escaneando archivos del proyecto: {:?}", root_path);

    let root_str = root_path.to_string_lossy().to_string();
    let matcher = build_gitignore_matcher(&root_path)?;

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

    let mut hidden = Vec::new();
    collect_hidden(&root_path, &root_str, &matcher, &mut hidden);
    hidden.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(hidden)
}
