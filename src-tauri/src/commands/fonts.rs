use std::fs;
use std::path::PathBuf;

use log::{error, info};
use serde::Serialize;
use tauri::Manager;

const DOWNLOADABLE_FONTS: &[(&str, &str)] = &[
    ("JetBrains Mono", "https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"),
    ("Fira Code", "https://raw.githubusercontent.com/google/fonts/main/ofl/firacode/FiraCode%5Bwght%5D.ttf"),
    ("Cascadia Code", "https://raw.githubusercontent.com/google/fonts/main/ofl/cascadiacode/CascadiaCode%5Bwght%5D.ttf"),
];

fn font_url(name: &str) -> Option<&'static str> {
    DOWNLOADABLE_FONTS.iter().find(|(n, _)| *n == name).map(|(_, url)| *url)
}

fn fonts_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?.join("fonts");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn font_file_path(app_handle: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    Ok(fonts_dir(app_handle)?.join(format!("{}.ttf", name)))
}

fn download_font_blocking(app_handle: &tauri::AppHandle, name: &str) -> Result<String, String> {
    let url = font_url(name).ok_or_else(|| format!("\"{}\" no es una tipografía descargable.", name))?;
    let dest = font_file_path(app_handle, name)?;

    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }

    info!("Descargando tipografía '{}' desde {}", name, url);

    let response = reqwest::blocking::get(url).map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        let message = format!("Error de descarga (HTTP {}) para la tipografía '{}'", response.status(), name);
        error!("{}", message);
        return Err(message);
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    let tmp_dest = dest.with_extension("download");
    fs::write(&tmp_dest, &bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp_dest, &dest).map_err(|e| e.to_string())?;

    info!("Tipografía '{}' descargada en {:?}", name, dest);
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn download_font(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || download_font_blocking(&app_handle, &name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_font_bytes(app_handle: tauri::AppHandle, name: String) -> Result<Vec<u8>, String> {
    let path = font_file_path(&app_handle, &name)?;
    fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_font(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
    let path = font_file_path(&app_handle, &name)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
        info!("Tipografía '{}' borrada", name);
    }
    Ok(())
}

#[derive(Serialize, Clone)]
pub struct LocalFont {
    pub name: String,
}

#[tauri::command]
pub fn list_downloaded_fonts(app_handle: tauri::AppHandle) -> Vec<LocalFont> {
    let Ok(dir) = fonts_dir(&app_handle) else { return vec![] };

    DOWNLOADABLE_FONTS
        .iter()
        .filter_map(|(name, _)| dir.join(format!("{}.ttf", name)).exists().then(|| LocalFont { name: name.to_string() }))
        .collect()
}
