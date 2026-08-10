use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;
use serde::{Serialize, Deserialize, Deserializer};
use log::{info, warn};

use crate::log_err::LogErr;

#[derive(Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ViewMode {
    #[default]
    List,
    Grid,
}

#[derive(Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LogRotation {
    /// Un fichero nuevo cada día.
    #[default]
    Daily,
    /// Un fichero nuevo en cada arranque del IDE.
    Session,
    /// Un fichero nuevo cada hora.
    Hourly,
}

fn lenient<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: serde::de::DeserializeOwned + Default,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value(value).unwrap_or_default())
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    #[serde(deserialize_with = "lenient")]
    pub view_mode: ViewMode,
    #[serde(deserialize_with = "lenient")]
    pub log_rotation: LogRotation,
}

fn config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        if !dir.exists() {
            fs::create_dir_all(dir).log_err("No se pudo crear la carpeta de configuración")?;
        }
    }
    Ok(())
}

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
            warn!("config.json corrupto, usando valores por defecto: {}", e);
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
    ensure_parent_dir(&path)?;

    let json = serde_json::to_string_pretty(&config).log_err("No se pudo serializar la configuración")?;
    fs::write(&path, json).log_err("No se pudo guardar config.json")?;

    info!("Configuración guardada en {:?}", path);
    Ok(())
}

#[tauri::command]
pub fn get_config_raw(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = config_path(&app_handle)?;

    if !path.exists() {
        save_config(app_handle.clone(), AppConfig::default())?;
    }

    fs::read_to_string(&path).log_err("No se pudo leer config.json")
}

#[tauri::command]
pub fn save_config_raw(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|e| format!("JSON inválido: {}", e))?;

    let path = config_path(&app_handle)?;
    ensure_parent_dir(&path)?;

    fs::write(&path, content).log_err("No se pudo guardar config.json")?;

    info!("config.json editado manualmente y guardado en {:?}", path);
    Ok(())
}
