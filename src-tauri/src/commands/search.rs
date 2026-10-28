use std::fs;
use std::path::Path;

use ignore::gitignore::Gitignore;

use crate::paths::project_path;
use super::file::build_gitignore_matcher;

const SKIPPED_DIRS: [&str; 2] = [".git", "node_modules"];
const MAX_FILES_LISTED: usize = 20_000;

fn walk(dir: &Path, root: &Path, matcher: &Gitignore, out: &mut Vec<(String, std::path::PathBuf)>) {
    if out.len() >= MAX_FILES_LISTED {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if SKIPPED_DIRS.contains(&name.as_str()) {
            continue;
        }
        let is_dir = path.is_dir();
        if matcher.matched(&path, is_dir).is_ignore() {
            continue;
        }
        if is_dir {
            walk(&path, root, matcher, out);
        } else if let Ok(rel) = path.strip_prefix(root) {
            out.push((rel.to_string_lossy().replace('\\', "/"), path));
        }
    }
}

fn project_files(root: &Path) -> Result<Vec<(String, std::path::PathBuf)>, String> {
    let matcher = build_gitignore_matcher(root)?;
    let mut files = Vec::new();
    walk(root, root, &matcher, &mut files);
    Ok(files)
}

#[tauri::command]
pub fn list_project_paths(app_handle: tauri::AppHandle, project_name: String) -> Result<Vec<String>, String> {
    let root = project_path(&app_handle, &project_name);
    Ok(project_files(&root)?.into_iter().map(|(rel, _)| rel).collect())
}
