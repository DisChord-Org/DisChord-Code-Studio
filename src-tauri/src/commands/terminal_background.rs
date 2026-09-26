use std::fs;
use std::path::Path;

const MAX_IMAGE_BYTES: u64 = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS: &[&str] = &["gif", "png", "jpg", "jpeg", "webp"];

fn read_image(path: &str) -> Result<Vec<u8>, String> {
    let path = Path::new(path);
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();

    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Formato no soportado (usa gif, png, jpg o webp).".to_string());
    }

    let size = fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > MAX_IMAGE_BYTES {
        return Err("La imagen pesa más de 15 MB.".to_string());
    }

    fs::read(path).map_err(|e| e.to_string())
}

/// Reads a user-chosen background image so the frontend can turn it into a Blob URL.
#[tauri::command]
pub async fn get_terminal_background_bytes(path: String) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || read_image(&path))
        .await
        .map_err(|e| e.to_string())?
}
