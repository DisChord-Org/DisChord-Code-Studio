//! Config sections: a small loader that lets a module (the terminal today; themes and
//! extensions later) declare its own settings without touching the main `AppConfig`.
//!
//! A section is described by a JSON *schema* (id, title, icon, an optional `requires` gate and a
//! list of typed fields). Schemas come from two places, and both go through the same loader:
//!   1. built in the binary (`config_schemas/*.json`, listed in `BUILTIN_SCHEMAS`), and
//!   2. `<app config dir>/schemas/*.json`, so a theme or extension can ship its own.
//! Values are stored per section in `<app config dir>/config.d/<id>.json`. Anything missing or
//! of the wrong type falls back to the field's default, so a schema can grow new fields without
//! breaking values saved by an older version.
//!
//! To add a section: drop a schema in `config_schemas/`, list it in `BUILTIN_SCHEMAS`, and read
//! its values from Rust with `section_values(app_handle, "<id>")`. The Settings screen renders
//! the form for it automatically.

use std::fs;
use std::path::PathBuf;

use log::{error, warn};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::Manager;

use crate::commands::config::load_config;
use crate::log_err::LogErr;

const BUILTIN_SCHEMAS: &[&str] = &[include_str!("config_schemas/terminal.json")];

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FieldKind {
    Boolean,
    Number,
    Text,
    Select,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SelectOption {
    pub value: String,
    pub label: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ConfigField {
    pub key: String,
    #[serde(rename = "type")]
    pub kind: FieldKind,
    pub label: String,
    #[serde(default)]
    pub description: String,
    pub default: Value,
    #[serde(default)]
    pub options: Vec<SelectOption>,
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    #[serde(default)]
    pub step: Option<f64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ConfigSchema {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub icon: String,
    /// Name of a boolean key in the main config (e.g. "advanced_mode"); the section only
    /// exists while that flag is on.
    #[serde(default)]
    pub requires: Option<String>,
    pub fields: Vec<ConfigField>,
}

#[derive(Serialize)]
pub struct ConfigSection {
    pub schema: ConfigSchema,
    pub values: Map<String, Value>,
}

fn config_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle.path().app_config_dir().map_err(|e| e.to_string())
}

/// The id ends up in a file name, so keep it to a safe charset.
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

fn parse_schema(source: &str, origin: &str) -> Option<ConfigSchema> {
    match serde_json::from_str::<ConfigSchema>(source) {
        Ok(schema) if valid_id(&schema.id) => Some(schema),
        Ok(schema) => {
            warn!("Esquema de configuración ignorado ({}): id no válido '{}'", origin, schema.id);
            None
        }
        Err(e) => {
            warn!("Esquema de configuración ignorado ({}): {}", origin, e);
            None
        }
    }
}

pub fn load_schemas(app_handle: &tauri::AppHandle) -> Vec<ConfigSchema> {
    let mut schemas: Vec<ConfigSchema> = BUILTIN_SCHEMAS
        .iter()
        .enumerate()
        .filter_map(|(i, source)| parse_schema(source, &format!("integrado #{}", i)))
        .collect();

    let Ok(dir) = config_dir(app_handle).map(|d| d.join("schemas")) else { return schemas };
    let Ok(entries) = fs::read_dir(&dir) else { return schemas };

    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "json"))
        .collect();
    files.sort();

    for path in files {
        let Ok(source) = fs::read_to_string(&path) else { continue };
        let Some(schema) = parse_schema(&source, &path.to_string_lossy()) else { continue };
        if schemas.iter().any(|s| s.id == schema.id) {
            warn!("Esquema '{}' ignorado: el id ya está en uso", schema.id);
            continue;
        }
        schemas.push(schema);
    }

    schemas
}

fn coerce(field: &ConfigField, value: Option<&Value>) -> Value {
    let Some(value) = value else { return field.default.clone() };

    match field.kind {
        FieldKind::Boolean if value.is_boolean() => value.clone(),
        FieldKind::Text if value.is_string() => value.clone(),
        FieldKind::Select => match value.as_str() {
            Some(s) if field.options.iter().any(|o| o.value == s) => value.clone(),
            _ => field.default.clone(),
        },
        FieldKind::Number => match value.as_f64() {
            Some(n) => {
                let n = n.max(field.min.unwrap_or(f64::MIN)).min(field.max.unwrap_or(f64::MAX));
                serde_json::Number::from_f64(n).map(Value::Number).unwrap_or_else(|| field.default.clone())
            }
            None => field.default.clone(),
        },
        _ => field.default.clone(),
    }
}

fn coerce_all(schema: &ConfigSchema, stored: &Map<String, Value>) -> Map<String, Value> {
    schema.fields.iter().map(|f| (f.key.clone(), coerce(f, stored.get(&f.key)))).collect()
}

fn values_path(app_handle: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(config_dir(app_handle)?.join("config.d").join(format!("{}.json", id)))
}

fn read_stored(app_handle: &tauri::AppHandle, id: &str) -> Map<String, Value> {
    let Ok(path) = values_path(app_handle, id) else { return Map::new() };
    let Ok(contents) = fs::read_to_string(path) else { return Map::new() };
    serde_json::from_str(&contents).unwrap_or_default()
}

fn gate_open(app_handle: &tauri::AppHandle, requires: &Option<String>) -> bool {
    let Some(key) = requires else { return true };
    serde_json::to_value(load_config(app_handle))
        .ok()
        .and_then(|config| config.get(key).and_then(Value::as_bool))
        .unwrap_or(false)
}

/// Current values of a section (defaults filled in), for Rust code that consumes them.
pub fn section_values(app_handle: &tauri::AppHandle, id: &str) -> Map<String, Value> {
    match load_schemas(app_handle).into_iter().find(|s| s.id == id) {
        Some(schema) => coerce_all(&schema, &read_stored(app_handle, id)),
        None => Map::new(),
    }
}

#[tauri::command]
pub fn get_config_sections(app_handle: tauri::AppHandle) -> Vec<ConfigSection> {
    load_schemas(&app_handle)
        .into_iter()
        .filter(|schema| gate_open(&app_handle, &schema.requires))
        .map(|schema| {
            let values = coerce_all(&schema, &read_stored(&app_handle, &schema.id));
            ConfigSection { schema, values }
        })
        .collect()
}

#[tauri::command]
pub fn save_config_section(app_handle: tauri::AppHandle, id: String, values: Map<String, Value>) -> Result<Map<String, Value>, String> {
    let schema = load_schemas(&app_handle)
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("La sección de configuración '{}' no existe", id))?;

    let coerced = coerce_all(&schema, &values);
    let path = values_path(&app_handle, &id)?;

    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).log_err("No se pudo crear la carpeta config.d")?;
    }
    let json = serde_json::to_string_pretty(&coerced).map_err(|e| e.to_string())?;
    fs::write(&path, json).inspect_err(|e| error!("No se pudo guardar {:?}: {}", path, e)).map_err(|e| e.to_string())?;

    Ok(coerced)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn select_field() -> ConfigField {
        serde_json::from_value(json!({
            "key": "mode", "type": "select", "label": "Mode", "default": "a",
            "options": [{ "value": "a", "label": "A" }, { "value": "b", "label": "B" }]
        }))
        .unwrap()
    }

    #[test]
    fn builtin_schemas_are_valid() {
        for (i, source) in BUILTIN_SCHEMAS.iter().enumerate() {
            assert!(parse_schema(source, &format!("integrado #{}", i)).is_some());
        }
    }

    #[test]
    fn rejects_unsafe_ids() {
        assert!(!valid_id("../evil"));
        assert!(!valid_id(""));
        assert!(valid_id("my-theme_2"));
    }

    #[test]
    fn coerce_falls_back_to_default() {
        let field = select_field();
        assert_eq!(coerce(&field, None), json!("a"));
        assert_eq!(coerce(&field, Some(&json!("b"))), json!("b"));
        assert_eq!(coerce(&field, Some(&json!("zzz"))), json!("a"));
        assert_eq!(coerce(&field, Some(&json!(3))), json!("a"));
    }

    #[test]
    fn coerce_clamps_numbers() {
        let field: ConfigField = serde_json::from_value(json!({
            "key": "n", "type": "number", "label": "N", "default": 5, "min": 1, "max": 10
        }))
        .unwrap();
        assert_eq!(coerce(&field, Some(&json!(99))).as_f64(), Some(10.0));
        assert_eq!(coerce(&field, Some(&json!(-4))).as_f64(), Some(1.0));
        assert_eq!(coerce(&field, Some(&json!("x"))), json!(5));
    }
}
