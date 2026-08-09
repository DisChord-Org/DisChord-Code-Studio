use std::fs;
use std::path::PathBuf;

use tauri::Manager;
use serde::{Serialize, Deserialize};
use log::{info, error, warn};

/// Config de la app persistida en disco. `#[serde(default)]` en cada campo
/// permite añadir opciones nuevas en el futuro sin romper la lectura de un
/// config.json guardado por una versión anterior del IDE.
#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub view_mode: String,
    pub log_rotation: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            view_mode: "list".to_string(),
            log_rotation: "daily".to_string(),
        }
    }
}

fn config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

/// Lee la config desde disco. Función normal (no comando) para poder
/// llamarla también durante el arranque de la app, antes de que el
/// `invoke_handler` esté disponible (p.ej. para elegir la rotación de logs).
pub fn load_config(app_handle: &tauri::AppHandle) -> AppConfig {
    let path = match config_path(app_handle) {
        Ok(p) => p,
        Err(e) => {
            warn!("No se pudo resolver la ruta de config.json: {}", e);
            return AppConfig::default();
        }
    };

    match fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_else(|e| {
            warn!("config.json corrupto o con formato antiguo, usando valores por defecto: {}", e);
            AppConfig::default()
        }),
        Err(_) => AppConfig::default(),
    }
}

#[tauri::command]
pub fn get_config(app_handle: tauri::AppHandle) -> AppConfig {
    load_config(&app_handle)
}

#[tauri::command]
pub fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app_handle)?;

    if let Some(dir) = path.parent() {
        if !dir.exists() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
    }

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| {
        error!("No se pudo guardar config.json: {}", e);
        e.to_string()
    })?;

    info!("Configuración guardada en {:?}", path);
    Ok(())
}
