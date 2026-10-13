use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime};

use log::{debug, warn};
use serde::{Deserialize, Serialize};

use crate::paths::project_path;
use crate::platform::{build_path_env, compiler_binary_path, silent_command, strip_npm_env};

const CHECK_TIMEOUT: Duration = Duration::from_secs(15);
const CORELIB_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_SOURCE_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    #[serde(default)]
    pub file: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default = "default_severity")]
    pub severity: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub line: Option<u32>,
    #[serde(default)]
    pub column: Option<u32>,
}

fn default_severity() -> String {
    "error".to_string()
}

#[derive(Serialize)]
pub struct CheckResult {
    ok: bool,
    diagnostics: Vec<Diagnostic>,
    tool_error: Option<String>,
}

#[derive(Deserialize)]
struct RawCheck {
    #[serde(default)]
    ok: bool,
    #[serde(default)]
    diagnostics: Vec<Diagnostic>,
}

struct Output {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn shorten(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() > 400 {
        format!("{}…", trimmed.chars().take(400).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

fn run_process(mut command: Command, stdin: Option<String>, timeout: Duration) -> Result<Output, String> {
    command
        .stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| format!("No se pudo ejecutar el compilador: {}", e))?;

    if let (Some(text), Some(mut pipe)) = (stdin, child.stdin.take()) {
        thread::spawn(move || {
            let _ = pipe.write_all(text.as_bytes());
        });
    }

    let mut out_pipe = child.stdout.take().ok_or("Sin salida estándar")?;
    let mut err_pipe = child.stderr.take().ok_or("Sin salida de errores")?;
    let out_reader = thread::spawn(move || {
        let mut text = String::new();
        let _ = out_pipe.read_to_string(&mut text);
        text
    });
    let err_reader = thread::spawn(move || {
        let mut text = String::new();
        let _ = err_pipe.read_to_string(&mut text);
        text
    });

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("El compilador no respondió en {} s.", timeout.as_secs()));
            }
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(e) => return Err(e.to_string()),
        }
    };

    Ok(Output {
        code: status.code(),
        stdout: out_reader.join().unwrap_or_default(),
        stderr: err_reader.join().unwrap_or_default(),
    })
}

fn compiler_command(app_handle: &tauri::AppHandle) -> Command {
    let mut command = match compiler_binary_path(app_handle).filter(|p| p.exists()) {
        Some(path) => silent_command(path),
        None => silent_command("dischord-compiler"),
    };

    strip_npm_env(&mut command);
    if let Some(path) = build_path_env(app_handle) {
        command.env("PATH", path);
    }

    command
}

fn tool_failure(message: String) -> CheckResult {
    CheckResult { ok: false, diagnostics: Vec::new(), tool_error: Some(message) }
}

fn parse_check(output: &Output) -> CheckResult {
    if output.code == Some(2) {
        let reason = if output.stderr.trim().is_empty() { &output.stdout } else { &output.stderr };
        return tool_failure(shorten(reason));
    }

    match serde_json::from_str::<RawCheck>(output.stdout.trim()) {
        Ok(raw) => CheckResult { ok: raw.ok, diagnostics: raw.diagnostics, tool_error: None },
        Err(_) => tool_failure(shorten(&format!("{}{}", output.stdout, output.stderr))),
    }
}

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

    let project_dir = project_path(&app_handle, &project_name);
    let file = project_dir.join(&file_path);

    let mut command = compiler_command(&app_handle);
    command
        .current_dir(&project_dir)
        .arg("--stdin")
        .arg("--stdin-filepath")
        .arg(&file)
        .arg("--json");

    tauri::async_runtime::spawn_blocking(move || {
        Ok(match run_process(command, Some(source), CHECK_TIMEOUT) {
            Ok(output) => parse_check(&output),
            Err(message) => tool_failure(message),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A name the source declares, with the exact range of the name (`line` and `column` start at 1, `end` is
/// just after the last character).
#[derive(Clone, Serialize, Deserialize)]
pub struct Declaration {
    pub kind: String,
    pub name: String,
    #[serde(default)]
    pub container: Option<String>,
    pub start: Position,
    pub end: Position,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub column: u32,
}

#[derive(Serialize)]
pub struct DeclarationsResult {
    /// Whether the code parsed: when it did not, `declarations` is empty and the editor keeps what it had.
    ok: bool,
    declarations: Vec<Declaration>,
    tool_error: Option<String>,
}

#[derive(Deserialize)]
struct RawEmit {
    #[serde(default)]
    ok: bool,
    #[serde(default)]
    declarations: Vec<Declaration>,
}

fn parse_declarations(output: &Output) -> DeclarationsResult {
    if output.code == Some(2) {
        let reason = if output.stderr.trim().is_empty() { &output.stdout } else { &output.stderr };
        return DeclarationsResult { ok: false, declarations: Vec::new(), tool_error: Some(shorten(reason)) };
    }

    match serde_json::from_str::<RawEmit>(output.stdout.trim()) {
        Ok(raw) => DeclarationsResult { ok: raw.ok, declarations: raw.declarations, tool_error: None },
        Err(_) => DeclarationsResult {
            ok: false,
            declarations: Vec::new(),
            tool_error: Some(shorten(&format!("{}{}", output.stdout, output.stderr))),
        },
    }
}

/// The names a buffer declares (`--emit ast`, which also works on code that is not saved).
#[tauri::command]
pub async fn compiler_declarations(
    app_handle: tauri::AppHandle,
    project_name: String,
    file_path: String,
    source: String,
) -> Result<DeclarationsResult, String> {
    if source.len() > MAX_SOURCE_BYTES {
        return Ok(DeclarationsResult { ok: false, declarations: Vec::new(), tool_error: Some("El archivo es demasiado grande.".into()) });
    }

    let project_dir = project_path(&app_handle, &project_name);
    let file = project_dir.join(&file_path);

    let mut command = compiler_command(&app_handle);
    command
        .current_dir(&project_dir)
        .arg("--stdin")
        .arg("--stdin-filepath")
        .arg(&file)
        .arg("--emit")
        .arg("ast");

    tauri::async_runtime::spawn_blocking(move || {
        Ok(match run_process(command, Some(source), CHECK_TIMEOUT) {
            Ok(output) => parse_declarations(&output),
            Err(message) => DeclarationsResult { ok: false, declarations: Vec::new(), tool_error: Some(message) },
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(PartialEq)]
struct BinaryStamp {
    path: Option<PathBuf>,
    len: Option<u64>,
    modified: Option<SystemTime>,
}

fn stamp(app_handle: &tauri::AppHandle) -> BinaryStamp {
    let path = compiler_binary_path(app_handle).filter(|p| p.exists());
    let metadata = path.as_ref().and_then(|p| std::fs::metadata(p).ok());

    BinaryStamp {
        path,
        len: metadata.as_ref().map(|m| m.len()),
        modified: metadata.and_then(|m| m.modified().ok()),
    }
}

static CORELIB_CACHE: Mutex<Option<(BinaryStamp, serde_json::Value)>> = Mutex::new(None);

#[tauri::command]
pub async fn compiler_corelib(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let current = stamp(&app_handle);

    if let Some((cached_stamp, value)) = CORELIB_CACHE.lock().unwrap().as_ref() {
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

    *CORELIB_CACHE.lock().unwrap() = Some((current, value.clone()));
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn output(code: i32, stdout: &str, stderr: &str) -> Output {
        Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn code_with_errors_is_not_a_tool_failure() {
        let result = parse_check(&output(
            1,
            r#"{"ok":false,"diagnostics":[{"file":"/p/src/a.chord","phase":"Análisis","severity":"error","message":"mal","line":2,"column":9}]}"#,
            "",
        ));

        assert!(!result.ok);
        assert!(result.tool_error.is_none());
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].line, Some(2));
        assert_eq!(result.diagnostics[0].column, Some(9));
    }

    #[test]
    fn clean_code_has_no_diagnostics() {
        let result = parse_check(&output(0, r#"{"ok":true,"diagnostics":[]}"#, ""));

        assert!(result.ok);
        assert!(result.diagnostics.is_empty());
        assert!(result.tool_error.is_none());
    }

    #[test]
    fn exit_code_two_is_a_tool_failure() {
        let result = parse_check(&output(2, "", "Uso incorrecto"));

        assert!(!result.ok);
        assert_eq!(result.tool_error.as_deref(), Some("Uso incorrecto"));
    }

    #[test]
    fn output_that_is_not_json_is_a_tool_failure() {
        let result = parse_check(&output(1, "algo raro", ""));

        assert!(result.tool_error.is_some());
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn reads_the_declarations_of_valid_code() {
        let result = parse_declarations(&output(
            0,
            r#"{"ok":true,"diagnostics":[],"schema":1,"emit":"ast","ast":[],"declarations":[{"kind":"parameter","name":"n","container":"saludar","start":{"line":3,"column":17},"end":{"line":3,"column":18}}]}"#,
            "",
        ));

        assert!(result.ok);
        assert_eq!(result.declarations.len(), 1);
        assert_eq!(result.declarations[0].container.as_deref(), Some("saludar"));
        assert_eq!(result.declarations[0].start.column, 17);
    }

    #[test]
    fn code_that_does_not_parse_has_no_declarations() {
        let result = parse_declarations(&output(1, r#"{"ok":false,"diagnostics":[{"message":"mal","line":1,"column":1}]}"#, ""));

        assert!(!result.ok);
        assert!(result.declarations.is_empty());
        assert!(result.tool_error.is_none());
    }

    #[test]
    fn a_diagnostic_without_a_place_is_kept() {
        let result = parse_check(&output(1, r#"{"ok":false,"diagnostics":[{"message":"sin sitio"}]}"#, ""));

        assert_eq!(result.diagnostics[0].line, None);
        assert_eq!(result.diagnostics[0].severity, "error");
    }

    #[cfg(unix)]
    #[test]
    fn feeds_stdin_and_collects_output() {
        let mut command = Command::new("cat");
        command.arg("-");

        let out = run_process(command, Some("hola mundo".into()), Duration::from_secs(5)).unwrap();

        assert_eq!(out.code, Some(0));
        assert_eq!(out.stdout, "hola mundo");
    }

    #[cfg(unix)]
    #[test]
    fn kills_a_process_that_takes_too_long() {
        let mut command = Command::new("sleep");
        command.arg("30");

        let started = Instant::now();
        let result = run_process(command, None, Duration::from_millis(300));

        assert!(result.is_err());
        assert!(started.elapsed() < Duration::from_secs(5));
    }
}
