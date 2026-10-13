use std::fs;

use serde::Serialize;

use crate::paths::project_path;

const MAX_SOURCE_BYTES: u64 = 512 * 1024;

#[derive(Serialize)]
pub struct LibrarySource {
    name: String,
    source: String,
}

#[tauri::command]
pub async fn get_library_sources(app_handle: tauri::AppHandle, project_name: String) -> Result<Vec<LibrarySource>, String> {
    let lib_dir = project_path(&app_handle, &project_name).join("lib");

    tauri::async_runtime::spawn_blocking(move || {
        let Ok(entries) = fs::read_dir(&lib_dir) else { return Vec::new() };

        let mut sources: Vec<LibrarySource> = entries
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                // `lib/<name>` is usually a symlink to the installed version; `metadata` follows it.
                let entry_file = entry.path().join("src").join("index.chord");
                let size = fs::metadata(&entry_file).ok()?.len();
                if size > MAX_SOURCE_BYTES {
                    return None;
                }

                Some(LibrarySource { name, source: fs::read_to_string(&entry_file).ok()? })
            })
            .collect();

        sources.sort_by(|a, b| a.name.cmp(&b.name));
        sources
    })
    .await
    .map_err(|e| e.to_string())
}
