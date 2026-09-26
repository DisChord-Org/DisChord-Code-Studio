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
    /// A new file every day.
    #[default]
    Daily,
    /// A new file every time the IDE starts.
    Session,
    /// A new file every hour.
    Hourly,
}

#[derive(Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackgroundFit {
    /// The whole image, right-aligned, with the rest left plain.
    Contain,
    /// The image fills the panel, cropping what does not fit.
    #[default]
    Cover,
}

#[derive(Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackgroundSource {
    /// The image that ships with the IDE.
    #[default]
    Bundled,
    /// The image at `terminal_background_image`.
    Custom,
    /// No background image.
    None,
}

fn lenient<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: serde::de::DeserializeOwned + Default,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value(value).unwrap_or_default())
}

fn default_editor_font_family() -> String {
    "Monocraft".to_string()
}

fn normalize_font_family<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer).unwrap_or_default();
    let bare = value
        .split(',')
        .next()
        .unwrap_or("")
        .trim()
        .trim_matches(['\'', '"'])
        .to_string();

    if bare.is_empty() {
        Ok(default_editor_font_family())
    } else {
        Ok(bare)
    }
}

fn default_editor_font_size() -> u32 {
    14
}

fn clamp_font_size<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    let parsed = value.as_u64().unwrap_or(default_editor_font_size() as u64);
    Ok((parsed as u32).clamp(8, 32))
}

fn default_editor_tab_size() -> u32 {
    4
}

fn clamp_tab_size<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    let parsed = value.as_u64().unwrap_or(default_editor_tab_size() as u64);
    Ok((parsed as u32).clamp(1, 8))
}

fn default_background_dim() -> u32 {
    96
}

fn clamp_dim<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    let parsed = value.as_u64().unwrap_or(default_background_dim() as u64);
    Ok((parsed as u32).min(100))
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    #[serde(deserialize_with = "lenient")]
    pub view_mode: ViewMode,
    #[serde(deserialize_with = "lenient")]
    pub log_rotation: LogRotation,
    #[serde(deserialize_with = "normalize_font_family")]
    pub editor_font_family: String,
    #[serde(deserialize_with = "clamp_font_size")]
    pub editor_font_size: u32,
    pub editor_word_wrap: bool,
    #[serde(deserialize_with = "clamp_tab_size")]
    pub editor_tab_size: u32,
    pub editor_use_tabs: bool,
    pub advanced_mode: bool,
    pub editor_keep_minimap: bool,
    pub editor_keep_statusbar: bool,
    pub editor_final_newline: bool,
    #[serde(deserialize_with = "lenient")]
    pub terminal_background_source: BackgroundSource,
    /// Absolute path of the custom image, used when the source is `custom`.
    pub terminal_background_image: String,
    /// How much the image is darkened so the text stays readable (0-100).
    #[serde(deserialize_with = "clamp_dim")]
    pub terminal_background_dim: u32,
    #[serde(deserialize_with = "lenient")]
    pub terminal_background_fit: BackgroundFit,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            view_mode: ViewMode::default(),
            log_rotation: LogRotation::default(),
            editor_font_family: default_editor_font_family(),
            editor_font_size: default_editor_font_size(),
            editor_word_wrap: false,
            editor_tab_size: default_editor_tab_size(),
            editor_use_tabs: true,
            advanced_mode: false,
            editor_keep_minimap: false,
            editor_keep_statusbar: false,
            editor_final_newline: true,
            terminal_background_source: BackgroundSource::default(),
            terminal_background_image: String::new(),
            terminal_background_dim: default_background_dim(),
            terminal_background_fit: BackgroundFit::default(),
        }
    }
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
