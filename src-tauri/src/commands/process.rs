use std::fs;
use std::path::Path;
use std::process::{ChildStderr, ChildStdout, Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread::{self, JoinHandle};

use tauri::{AppHandle, Manager, State};
use log::{info, error, warn};

use crate::ChildProcessState;
use crate::paths::project_path;
#[cfg(target_os = "windows")]
use crate::platform::silent_command;
use crate::platform::{resolve_chord_command, strip_npm_env, bin_dir, pnpm_command, build_path_env};
use crate::log_err::LogErr;
use crate::commands::compiler::check_project;
use crate::output::{emit_line, emit_located_line, emit_run_end, LineKind, Location, RunStatus};

/// Terminates a project run together with everything it started. `chord` launches the bot through other
/// processes (a shell, node), so killing only `chord` left those alive and they piled up in memory.
/// On Unix the run is its own process group, so the whole group gets the signal; on Windows `taskkill /T`
/// walks the tree.
pub fn kill_run(mut child: std::process::Child) {
    let pid = child.id();

    #[cfg(target_os = "windows")]
    {
        let res = silent_command("taskkill").arg("/F").arg("/T").arg("/PID").arg(pid.to_string()).spawn();
        if res.is_err() {
            error!("Fallo al ejecutar taskkill para PID {}", pid);
            let _ = child.kill();
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let group = pid as libc::pid_t;
        // Politely first, so the bot can close its connections; whatever is still alive soon after is killed.
        unsafe { libc::killpg(group, libc::SIGTERM) };
        thread::spawn(move || {
            thread::sleep(std::time::Duration::from_secs(2));
            unsafe { libc::killpg(group, libc::SIGKILL) };
        });
    }

    // Reaping the child keeps it from lingering as a zombie.
    thread::spawn(move || {
        let _ = child.wait();
    });
}

/// Streams a child process' stdout/stderr into the "terminal-output" event, line by line, tagged by stream.
/// Returns the two reader threads so the caller can `.join()` them before deciding what to do once the process is done.
fn stream_to_terminal(app_handle: &AppHandle, stdout: ChildStdout, stderr: ChildStderr) -> (JoinHandle<()>, JoinHandle<()>) {
    let handle_out = app_handle.clone();
    let stdout_thread = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                emit_line(&handle_out, LineKind::Stdout, l);
            }
        }
    });

    let handle_err = app_handle.clone();
    let stderr_thread = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                emit_line(&handle_err, LineKind::Stderr, l);
            }
        }
    });

    (stdout_thread, stderr_thread)
}

fn declared_dependency_names(package_json_path: &Path) -> Vec<String> {
    let Ok(text) = fs::read_to_string(package_json_path) else { return Vec::new() };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { return Vec::new() };

    let mut names = Vec::new();
    for key in ["dependencies", "devDependencies"] {
        if let Some(obj) = json.get(key).and_then(|v| v.as_object()) {
            names.extend(obj.keys().cloned());
        }
    }
    names
}

fn dependencies_satisfied(project_dir: &Path) -> bool {
    let node_modules = project_dir.join("node_modules");
    if !node_modules.exists() {
        return false;
    }

    let names = declared_dependency_names(&project_dir.join("package.json"));
    names.iter().all(|name| node_modules.join(name).exists())
}

fn run_pnpm_install_once(app_handle: &tauri::AppHandle, project_dir: &Path) -> Result<(), String> {
    let mut command = pnpm_command(app_handle)
        .ok_or("No se encontró pnpm para instalar las dependencias del proyecto")?;
    command.current_dir(project_dir);
    if let Some(path) = build_path_env(app_handle) {
        command.env("PATH", path);
    }
    command.arg("install")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().log_err("No se pudo ejecutar 'pnpm install'")?;

    let stdout = child.stdout.take().expect("Fallo al capturar stdout de pnpm install");
    let stderr = child.stderr.take().expect("Fallo al capturar stderr de pnpm install");

    let (stdout_thread, stderr_thread) = stream_to_terminal(app_handle, stdout, stderr);
    let _ = stdout_thread.join();
    let _ = stderr_thread.join();

    let status = child.wait().log_err("Fallo esperando a 'pnpm install'")?;
    if !status.success() {
        return Err("Fallo al instalar las dependencias del proyecto ('pnpm install')".into());
    }

    Ok(())
}

const PNPM_INSTALL_ATTEMPTS: u32 = 3;

fn ensure_dependencies_installed(app_handle: &tauri::AppHandle, project_dir: &Path) -> Result<(), String> {
    if !project_dir.join("package.json").exists() || dependencies_satisfied(project_dir) {
        return Ok(());
    }

    emit_line(app_handle, LineKind::Info, "Instalando dependencias del proyecto (pnpm install)...");

    let mut last_err = String::new();
    for attempt in 1..=PNPM_INSTALL_ATTEMPTS {
        match run_pnpm_install_once(app_handle, project_dir) {
            Ok(()) => {
                emit_line(app_handle, LineKind::Success, "Dependencias instaladas correctamente.");
                return Ok(());
            }
            Err(e) => {
                last_err = e;
                if attempt < PNPM_INSTALL_ATTEMPTS {
                    warn!("'pnpm install' falló (intento {}/{}): {}", attempt, PNPM_INSTALL_ATTEMPTS, last_err);
                    emit_line(
                        app_handle,
                        LineKind::Warning,
                        format!("'pnpm install' falló, reintentando ({}/{})...", attempt, PNPM_INSTALL_ATTEMPTS),
                    );
                    thread::sleep(std::time::Duration::from_secs(2));
                }
            }
        }
    }

    Err(last_err)
}

fn relative_to(project_dir: &Path, file: &str) -> Option<String> {
    let relative = Path::new(file).strip_prefix(project_dir).ok()?;
    Some(relative.to_string_lossy().replace('\\', "/"))
}

fn report_compile_errors(app_handle: &tauri::AppHandle, project_dir: &Path) -> bool {
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

#[tauri::command]
pub fn run_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>, project_name: String) -> Result<(), String> {
    let project_dir = project_path(&app_handle, &project_name);

    let mut chord_file = project_dir.clone();
    chord_file.push("src");
    chord_file.push("index.chord");

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

    let mut command = resolve_chord_command(&app_handle);
    command.current_dir(&project_dir);
    command.env("NODE_OPTIONS", "--experimental-default-type=module");
    strip_npm_env(&mut command);

    if let Some(path) = build_path_env(&app_handle) {
        command.env("PATH", path);
    }

    command.arg("run")
        .arg("src/index.chord")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let mut child = command.spawn().log_err("No se pudo spawnear el proceso 'chord'")?;

    let pid = child.id();
    info!("Proceso 'chord' iniciado con PID: {}", pid);

    let stdout = child.stdout.take().expect("Fallo al capturar stdout");
    let stderr = child.stderr.take().expect("Fallo al capturar stderr");

    {
        let mut lock = state.0.lock().unwrap();
        *lock = Some(child);
    }

    let state_arc = state.0.clone();
    let handle_clone = app_handle.clone();

    thread::spawn(move || {
        let (stdout_thread, stderr_thread) = stream_to_terminal(&handle_clone, stdout, stderr);
        let _ = stdout_thread.join();
        let _ = stderr_thread.join();

        let mut lock = state_arc.lock().unwrap();

        if let Some(mut child) = lock.take() {
            let status = match child.wait() {
                Ok(exit) if exit.success() => RunStatus::Finished,
                Ok(exit) => RunStatus::Failed { code: exit.code() },
                Err(_) => RunStatus::Failed { code: None },
            };
            info!("El proceso hijo {} ha finalizado", pid);
            emit_run_end(&handle_clone, status);
        }
        *lock = None;
    });

    Ok(())
}

#[tauri::command]
pub fn stop_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>) -> Result<String, String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(child) = lock.take() {
        let pid = child.id();
        info!("Solicitud de detención para proceso PID: {}", pid);

        kill_run(child);

        emit_run_end(&app_handle, RunStatus::Stopped);
        info!("Proceso {} detenido correctamente.", pid);
        Ok("Proceso detenido".into())
    } else {
        warn!("Se intentó detener un proceso, pero no hay ninguno activo");
        Err("No hay ningún proceso en ejecución".into())
    }
}

fn open_path_in_explorer(path: &Path) -> Result<(), String> {
    let cmd = if cfg!(target_os = "windows") {
        Command::new("explorer").arg(path).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(path).spawn()
    } else {
        Command::new("xdg-open").arg(path).spawn()
    };

    cmd.log_err("Fallo al abrir el explorador")?;
    Ok(())
}

#[tauri::command]
pub fn open_in_explorer(app_handle: tauri::AppHandle, project_name: String) -> Result<(), String> {
    let path = project_path(&app_handle, &project_name);

    if !path.exists() {
        warn!("Intento de abrir explorador en ruta inexistente: {:?}", path);
        return Err("El proyecto no existe".to_string());
    }

    info!("Abriendo explorador de archivos en: {:?}", path);
    open_path_in_explorer(&path)
}

#[tauri::command]
pub fn open_logs_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let dir = app_handle.path().app_log_dir().map_err(|e| e.to_string())?;

    if !dir.exists() {
        fs::create_dir_all(&dir).log_err("No se pudo crear la carpeta de logs")?;
    }

    info!("Abriendo carpeta de logs en: {:?}", dir);
    open_path_in_explorer(&dir)
}

#[tauri::command]
pub fn open_app_data_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let log_dir = app_handle.path().app_log_dir().map_err(|e| e.to_string())?;
    let dir = log_dir.parent().ok_or("No se pudo determinar la carpeta de datos de la app")?;

    if !dir.exists() {
        fs::create_dir_all(dir).log_err("No se pudo crear la carpeta de datos de la app")?;
    }

    info!("Abriendo carpeta de datos de la app en: {:?}", dir);
    open_path_in_explorer(dir)
}

#[tauri::command]
pub fn open_binaries_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let dir = bin_dir(&app_handle).ok_or("No se pudo determinar la carpeta de binarios")?;

    if !dir.exists() {
        fs::create_dir_all(&dir).log_err("No se pudo crear la carpeta de binarios")?;
    }

    info!("Abriendo carpeta de binarios en: {:?}", dir);
    open_path_in_explorer(&dir)
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
        // Like `chord`: a process that starts others and would leave them behind if only it were killed.
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

#[cfg(test)]
mod path_tests {
    use super::*;

    #[test]
    fn paths_inside_the_project_become_relative() {
        let project = Path::new("/home/u/proyectos/bot");

        assert_eq!(relative_to(project, "/home/u/proyectos/bot/src/index.chord").as_deref(), Some("src/index.chord"));
    }

    #[test]
    fn paths_outside_the_project_are_dropped() {
        let project = Path::new("/home/u/proyectos/bot");

        assert_eq!(relative_to(project, "/home/u/otro/src/index.chord"), None);
    }
}
