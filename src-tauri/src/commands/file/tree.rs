use std::collections::HashMap;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

use serde::Serialize;
use ignore::gitignore::Gitignore;
use ignore::WalkBuilder;
use log::info;

use crate::paths::resolve_in_project;
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

fn walker(root: &Path) -> WalkBuilder {
    let mut builder = WalkBuilder::new(root);
    builder.standard_filters(false).hidden(false).follow_links(false);
    builder
}

fn is_always_skipped(name: &OsStr) -> bool {
    name == GITIGNORE_FILE || name == GIT_DIR || name == DEPENDENCIES_DIR
}

fn build_children(parent: &Path, root_str: &str, by_parent: &mut HashMap<PathBuf, Vec<(PathBuf, bool)>>) -> Vec<ProjectFile> {
    let mut files: Vec<ProjectFile> = by_parent
        .remove(parent)
        .unwrap_or_default()
        .into_iter()
        .map(|(path, is_dir)| ProjectFile {
            name: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
            is_dir,
            relative_path: to_relative(&path, root_str),
            children: is_dir.then(|| build_children(&path, root_str, by_parent)),
        })
        .collect();

    files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    files
}

fn scan_tree(root: &Path, root_str: &str, matcher: Gitignore) -> Vec<ProjectFile> {
    let mut by_parent: HashMap<PathBuf, Vec<(PathBuf, bool)>> = HashMap::new();

    let entries = walker(root)
        .filter_entry(move |entry| {
            if entry.depth() == 0 {
                return true;
            }
            let is_dir = entry.file_type().is_some_and(|t| t.is_dir());
            !is_always_skipped(entry.file_name()) && !matcher.matched(entry.path(), is_dir).is_ignore()
        })
        .build()
        .flatten();

    for entry in entries {
        if entry.depth() == 0 {
            continue;
        }
        let is_dir = entry.file_type().is_some_and(|t| t.is_dir());
        if let Some(parent) = entry.path().parent() {
            by_parent.entry(parent.to_path_buf()).or_default().push((entry.into_path(), is_dir));
        }
    }

    build_children(root, root_str, &mut by_parent)
}

fn collect_hidden(root: &Path, root_str: &str, matcher: &Gitignore) -> Vec<ProjectFile> {
    walker(root)
        .filter_entry(|entry| entry.depth() == 0 || !is_always_skipped(entry.file_name()))
        .build()
        .flatten()
        .filter(|entry| entry.file_type().is_some_and(|t| !t.is_dir()))
        .filter(|entry| matcher.matched(entry.path(), false).is_ignore())
        .map(|entry| ProjectFile {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: false,
            relative_path: to_relative(entry.path(), root_str),
            children: None,
        })
        .collect()
}

#[tauri::command]
pub async fn read_project_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_path = resolve_in_project(&app_handle, &name, "")?;
        info!("Escaneando archivos del proyecto: {:?}", root_path);

        let root_str = root_path.to_string_lossy().to_string();
        let matcher = build_gitignore_matcher(&root_path)?;

        let result = scan_tree(&root_path, &root_str, matcher);
        info!("Escaneo completado con éxito para '{}'", name);
        Ok(result)
    })
    .await
    .map_err(|e| format!("La tarea de escaneo falló: {}", e))?
}

#[tauri::command]
pub async fn read_hidden_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_path = resolve_in_project(&app_handle, &name, "")?;
        info!("Escaneando ficheros ocultos del proyecto: {:?}", root_path);

        let root_str = root_path.to_string_lossy().to_string();
        let matcher = build_gitignore_matcher(&root_path)?;

        let mut hidden = collect_hidden(&root_path, &root_str, &matcher);
        hidden.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(hidden)
    })
    .await
    .map_err(|e| format!("La tarea de escaneo falló: {}", e))?
}
