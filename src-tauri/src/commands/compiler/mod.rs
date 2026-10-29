mod corelib;
mod declarations;
mod diagnostics;
mod run;

use log::{debug, warn};

use corelib::{corelib_cache, stamp};
pub use declarations::DeclarationsResult;
use declarations::{declarations_failure, parse_declarations};
pub use diagnostics::CheckResult;
use diagnostics::{parse_check, tool_failure};
use run::{compiler_command, run_process, shorten, stdin_command, CHECK_TIMEOUT, CORELIB_TIMEOUT};

const MAX_SOURCE_BYTES: usize = 2 * 1024 * 1024;

#[tauri::command]
pub async fn compiler_check(
    app_handle: tauri::AppHandle,
    project_name: String,
    file_path: String,
    source: String,
) -> Result<CheckResult, String> {
    if source.len() > MAX_SOURCE_BYTES {
        return Ok(tool_failure("El archivo es demasiado grande para comprobarlo mientras escribes.".into()));
    }

    let (mut command, file) = stdin_command(&app_handle, &project_name, &file_path)?;
    command.arg("--json");

    tauri::async_runtime::spawn_blocking(move || {
        let result = match run_process(command, Some(source), CHECK_TIMEOUT) {
            Ok(output) => parse_check(&output),
            Err(message) => tool_failure(message),
        };

        if let Some(reason) = &result.tool_error {
            warn!("El compilador no pudo comprobar {:?}: {}", file, reason);
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn check_project(app_handle: &tauri::AppHandle, project_dir: &std::path::Path) -> CheckResult {
    let mut command = compiler_command(app_handle);
    command.current_dir(project_dir).arg("--check").arg("--json");

    match run_process(command, None, CHECK_TIMEOUT) {
        Ok(output) => parse_check(&output),
        Err(message) => tool_failure(message),
    }
}
#[tauri::command]
pub async fn compiler_declarations(
    app_handle: tauri::AppHandle,
    project_name: String,
    file_path: String,
    source: String,
) -> Result<DeclarationsResult, String> {
    if source.len() > MAX_SOURCE_BYTES {
        return Ok(declarations_failure("El archivo es demasiado grande.".into()));
    }

    let (mut command, _) = stdin_command(&app_handle, &project_name, &file_path)?;
    command.arg("--emit").arg("ast");

    tauri::async_runtime::spawn_blocking(move || {
        Ok(match run_process(command, Some(source), CHECK_TIMEOUT) {
            Ok(output) => parse_declarations(&output),
            Err(message) => declarations_failure(message),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn compiler_corelib(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let current = stamp(&app_handle);

    if let Some((cached_stamp, value)) = corelib_cache().as_ref() {
        if *cached_stamp == current {
            return Ok(value.clone());
        }
    }

    let mut command = compiler_command(&app_handle);
    command.arg("corelib").arg("--json");

    let value = tauri::async_runtime::spawn_blocking(move || -> Result<serde_json::Value, String> {
        let output = run_process(command, None, CORELIB_TIMEOUT)?;
        if output.code != Some(0) {
            return Err(shorten(&format!("{}{}", output.stdout, output.stderr)));
        }
        serde_json::from_str(output.stdout.trim()).map_err(|e| format!("Respuesta de corelib no válida: {}", e))
    })
    .await
    .map_err(|e| e.to_string())??;

    debug!("Vocabulario del compilador cargado (versión {:?})", value.get("compilerVersion"));
    if value.get("schema").is_none() {
        warn!("El vocabulario del compilador no declara 'schema'");
    }

    *corelib_cache() = Some((current, value.clone()));
    Ok(value)
}
