use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

use crate::log_err::LogErr;
use crate::paths::resolve_in_project;
use crate::proc::wait_with_timeout;
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

    let child = command.spawn().log_err("No se pudo ejecutar el compilador")?;
    let captured = wait_with_timeout(child, stdin, timeout, POLL_INTERVAL, kill_child)?;
    if captured.timed_out {
        return Err(format!("El compilador no respondió en {} s.", timeout.as_secs()));
    }

    Ok(Output { code: captured.code, stdout: captured.stdout, stderr: captured.stderr })
}

fn kill_child(child: &mut std::process::Child) {
    let _ = child.kill();
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

pub(super) fn stdin_command(app_handle: &tauri::AppHandle, project_name: &str, file_path: &str) -> Result<(Command, PathBuf), String> {
    let project_dir = resolve_in_project(app_handle, project_name, "")?;
    let file = resolve_in_project(app_handle, project_name, file_path)?;

    let mut command = compiler_command(app_handle);
    command.current_dir(&project_dir).arg("--stdin").arg("--stdin-filepath").arg(&file);
    Ok((command, file))
}
