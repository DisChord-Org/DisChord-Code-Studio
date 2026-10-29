use std::fs;
use std::path::Path;

use log::{info, warn};
use tauri::{AppHandle, Manager};

use crate::log_err::LogErr;
use crate::paths::resolve_in_project;
use crate::platform::{bin_dir, open_in_file_manager};

fn open_path_in_explorer(path: &Path) -> Result<(), String> {
    open_in_file_manager(path).log_err("Fallo al abrir el explorador")?;
    Ok(())
}

pub(super) fn open_project(app_handle: &AppHandle, project_name: &str) -> Result<(), String> {
    let path = resolve_in_project(app_handle, project_name, "")?;

    if !path.exists() {
        warn!("Intento de abrir explorador en ruta inexistente: {:?}", path);
        return Err("El proyecto no existe".to_string());
    }

    info!("Abriendo explorador de archivos en: {:?}", path);
    open_path_in_explorer(&path)
}

pub(super) fn open_logs(app_handle: &AppHandle) -> Result<(), String> {
    let dir = app_handle.path().app_log_dir().map_err(|e| e.to_string())?;

    if !dir.exists() {
        fs::create_dir_all(&dir).log_err("No se pudo crear la carpeta de logs")?;
    }

    info!("Abriendo carpeta de logs en: {:?}", dir);
    open_path_in_explorer(&dir)
}

pub(super) fn open_app_data(app_handle: &AppHandle) -> Result<(), String> {
    let log_dir = app_handle.path().app_log_dir().map_err(|e| e.to_string())?;
    let dir = log_dir.parent().ok_or("No se pudo determinar la carpeta de datos de la app")?;

    if !dir.exists() {
        fs::create_dir_all(dir).log_err("No se pudo crear la carpeta de datos de la app")?;
    }

    info!("Abriendo carpeta de datos de la app en: {:?}", dir);
    open_path_in_explorer(dir)
}

pub(super) fn open_binaries(app_handle: &AppHandle) -> Result<(), String> {
    let dir = bin_dir(app_handle).ok_or("No se pudo determinar la carpeta de binarios")?;

    if !dir.exists() {
        fs::create_dir_all(&dir).log_err("No se pudo crear la carpeta de binarios")?;
    }

    info!("Abriendo carpeta de binarios en: {:?}", dir);
    open_path_in_explorer(&dir)
}
