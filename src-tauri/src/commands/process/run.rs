use std::path::Path;
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use log::{error, info, warn};
use tauri::AppHandle;

use super::install::ensure_dependencies_installed;
use super::stream::stream_to_terminal;
use crate::commands::compiler::check_project;
use crate::log_err::LogErr;
use crate::output::{emit_line, emit_located_line, emit_run_end, LineKind, Location, RunStatus};
use crate::paths::resolve_in_project;
use crate::platform::{build_path_env, isolate_process_group, resolve_chord_command, strip_npm_env, terminate_process_tree};
use crate::ChildProcessState;

const ENTRY_POINT: &str = "src/index.chord";
const NODE_OPTIONS: &str = "--experimental-default-type=module";

pub fn kill_run(mut child: Child) {
    terminate_process_tree(&mut child);

    thread::spawn(move || {
        let _ = child.wait();
    });
}

fn relative_to(project_dir: &Path, file: &str) -> Option<String> {
    let relative = Path::new(file).strip_prefix(project_dir).ok()?;
    Some(relative.to_string_lossy().replace('\\', "/"))
}

fn report_compile_errors(app_handle: &AppHandle, project_dir: &Path) -> bool {
    let result = check_project(app_handle, project_dir);

    if let Some(reason) = &result.tool_error {
        warn!("No se pudo comprobar el proyecto antes de ejecutarlo: {}", reason);
        return false;
    }

    let errors: Vec<_> = result.diagnostics.iter().filter(|d| d.severity == "error").collect();

    for diagnostic in &result.diagnostics {
        let kind = if diagnostic.severity == "error" { LineKind::Error } else { LineKind::Warning };
        let text = match &diagnostic.phase {
            Some(phase) => format!("[{}] {}", phase, diagnostic.message),
            None => diagnostic.message.clone(),
        };
        let location = match (&diagnostic.file, diagnostic.line) {
            (Some(file), Some(line)) => relative_to(project_dir, file).map(|path| Location {
                path,
                line,
                column: diagnostic.column.unwrap_or(1),
            }),
            _ => None,
        };

        emit_located_line(app_handle, kind, text, location);
    }

    if errors.is_empty() {
        return false;
    }

    let count = errors.len();
    emit_line(
        app_handle,
        LineKind::Error,
        format!("{} {} de compilación: el bot no se ha ejecutado.", count, if count == 1 { "error" } else { "errores" }),
    );
    emit_run_end(app_handle, RunStatus::Failed { code: Some(1) });
    true
}

fn lock_run(state: &Mutex<Option<Child>>) -> MutexGuard<'_, Option<Child>> {
    state.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn chord_run_command(app_handle: &AppHandle, project_dir: &Path) -> Command {
    let mut command = resolve_chord_command(app_handle);
    command.current_dir(project_dir);
    command.env("NODE_OPTIONS", NODE_OPTIONS);
    strip_npm_env(&mut command);

    if let Some(path) = build_path_env(app_handle) {
        command.env("PATH", path);
    }

    command.arg("run").arg(ENTRY_POINT).stdout(Stdio::piped()).stderr(Stdio::piped());

    isolate_process_group(&mut command);

    command
}

fn watch_run(app_handle: AppHandle, run: Arc<Mutex<Option<Child>>>, pid: u32, stdout: ChildStdout, stderr: ChildStderr) {
    thread::spawn(move || {
        let (stdout_thread, stderr_thread) = stream_to_terminal(&app_handle, stdout, stderr);
        let _ = stdout_thread.join();
        let _ = stderr_thread.join();

        if let Some(mut child) = lock_run(&run).take() {
            let status = match child.wait() {
                Ok(exit) if exit.success() => RunStatus::Finished,
                Ok(exit) => RunStatus::Failed { code: exit.code() },
                Err(_) => RunStatus::Failed { code: None },
            };
            info!("El proceso hijo {} ha finalizado", pid);
            emit_run_end(&app_handle, status);
        }
    });
}

pub(super) fn start(app_handle: AppHandle, state: &ChildProcessState, project_name: String) -> Result<(), String> {
    let project_dir = resolve_in_project(&app_handle, &project_name, "")?;

    let chord_file = project_dir.join(ENTRY_POINT);
    if !chord_file.exists() {
        error!("Fallo al ejecutar: No existe index.chord en {:?}", chord_file);
        return Err(format!("No se encontró el archivo: {:?}", chord_file));
    }

    info!("Iniciando ejecución del proyecto: {}", project_name);

    ensure_dependencies_installed(&app_handle, &project_dir)
        .log_err("No se pudieron instalar las dependencias del proyecto")?;

    if report_compile_errors(&app_handle, &project_dir) {
        return Ok(());
    }

    let mut child = chord_run_command(&app_handle, &project_dir)
        .spawn()
        .log_err("No se pudo spawnear el proceso 'chord'")?;

    let pid = child.id();
    info!("Proceso 'chord' iniciado con PID: {}", pid);

    let (Some(stdout), Some(stderr)) = (child.stdout.take(), child.stderr.take()) else {
        kill_run(child);
        return Err("Fallo al capturar la salida del proceso 'chord'".into());
    };

    *lock_run(&state.0) = Some(child);
    watch_run(app_handle, state.0.clone(), pid, stdout, stderr);

    Ok(())
}

pub(super) fn stop(app_handle: &AppHandle, state: &ChildProcessState) -> Result<String, String> {
    let mut lock = lock_run(&state.0);
    if let Some(child) = lock.take() {
        let pid = child.id();
        info!("Solicitud de detención para proceso PID: {}", pid);

        kill_run(child);

        emit_run_end(app_handle, RunStatus::Stopped);
        info!("Proceso {} detenido correctamente.", pid);
        Ok("Proceso detenido".into())
    } else {
        warn!("Se intentó detener un proceso, pero no hay ninguno activo");
        Err("No hay ningún proceso en ejecución".into())
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::process::CommandExt;

    fn alive(marker: &str) -> bool {
        Command::new("pgrep").args(["-f", marker]).output().map(|o| o.status.success()).unwrap_or(false)
    }

    #[test]
    fn stopping_a_run_takes_down_what_it_spawned() {
        let marker = format!("sleep 4{}", std::process::id());
        let script = format!("{m} & {m} & wait", m = marker);
        let child = Command::new("sh").arg("-c").arg(&script).process_group(0).spawn().unwrap();

        thread::sleep(std::time::Duration::from_millis(300));
        assert!(alive(&marker), "the helpers should be running before the stop");

        kill_run(child);

        for _ in 0..30 {
            if !alive(&marker) {
                return;
            }
            thread::sleep(std::time::Duration::from_millis(100));
        }
        panic!("processes started by the run survived the stop");
    }
}
