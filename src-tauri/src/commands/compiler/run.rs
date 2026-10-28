use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use crate::log_err::LogErr;
use crate::paths::project_path;
use crate::platform::{build_path_env, compiler_binary_path, silent_command, strip_npm_env};

pub(super) const CHECK_TIMEOUT: Duration = Duration::from_secs(15);
pub(super) const CORELIB_TIMEOUT: Duration = Duration::from_secs(20);
pub(super) const EXIT_TOOL_FAILURE: i32 = 2;

const POLL_INTERVAL: Duration = Duration::from_millis(10);

pub(super) struct Output {
    pub(super) code: Option<i32>,
    pub(super) stdout: String,
    pub(super) stderr: String,
}

pub(super) fn shorten(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() > 400 {
        format!("{}…", trimmed.chars().take(400).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

pub(super) fn run_process(mut command: Command, stdin: Option<String>, timeout: Duration) -> Result<Output, String> {
    command
        .stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().log_err("No se pudo ejecutar el compilador")?;

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
            Ok(None) => thread::sleep(POLL_INTERVAL),
            Err(e) => return Err(e.to_string()),
        }
    };

    Ok(Output {
        code: status.code(),
        stdout: out_reader.join().unwrap_or_default(),
        stderr: err_reader.join().unwrap_or_default(),
    })
}

pub(super) fn failure_reason(output: &Output) -> String {
    let reason = if output.stderr.trim().is_empty() { &output.stdout } else { &output.stderr };
    shorten(reason)
}

pub(super) fn combined_output(output: &Output) -> String {
    shorten(&format!("{}{}", output.stdout, output.stderr))
}
pub(super) fn compiler_command(app_handle: &tauri::AppHandle) -> Command {
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

pub(super) fn stdin_command(app_handle: &tauri::AppHandle, project_name: &str, file_path: &str) -> (Command, PathBuf) {
    let project_dir = project_path(app_handle, project_name);
    let file = project_dir.join(file_path);

    let mut command = compiler_command(app_handle);
    command.current_dir(&project_dir).arg("--stdin").arg("--stdin-filepath").arg(&file);
    (command, file)
}
