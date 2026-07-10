use std::fs;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{Manager, Emitter, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;

use serde::{Serialize, Deserialize};
use log::{info, error, warn, debug};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::{ChildProcessState, UpdateState};

#[derive(Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub target: String,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Deserialize)]
struct CliProgressLine {
    tool: String,
    phase: String,
    #[serde(default)]
    percent: Option<f64>,
    #[serde(default)]
    current_bytes: Option<u64>,
    #[serde(default)]
    total_bytes: Option<u64>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    message: Option<String>,
}

fn emit_progress(
    app_handle: &tauri::AppHandle,
    target: &str,
    phase: &str,
    percent: Option<f64>,
    current_bytes: Option<u64>,
    total_bytes: Option<u64>,
    version: Option<String>,
    message: Option<String>,
) {
    let payload = UpdateProgress {
        target: target.to_string(),
        phase: phase.to_string(),
        percent,
        current_bytes,
        total_bytes,
        version,
        message,
    };

    if let Some(state) = app_handle.try_state::<UpdateState>() {
        if let Ok(mut map) = state.0.lock() {
            map.insert(target.to_string(), payload.clone());
        }
    }

    let _ = app_handle.emit("update-progress", payload);
}

#[tauri::command]
pub fn get_update_state(app_handle: tauri::AppHandle) -> Vec<UpdateProgress> {
    let state = app_handle.state::<UpdateState>();
    let map = state.0.lock().unwrap();
    map.values().cloned().collect()
}

fn open_update_window(app_handle: &tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app_handle.get_webview_window("update") {
        let _ = w.set_focus();
        return Ok(());
    }

    info!("Abriendo ventana de actualización");

    WebviewWindowBuilder::new(app_handle, "update", WebviewUrl::App("index.html".into()))
        .title("Actualizando DisChord")
        .inner_size(800.0, 600.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .center()
        .build()
        .map_err(|e| {
            error!("No se pudo crear la ventana de actualización: {}", e);
            e.to_string()
        })?;

    Ok(())
}

pub async fn run_ide_update(app_handle: tauri::AppHandle) {
    emit_progress(&app_handle, "ide", "checking", None, None, None, None, None);

    let updater = match app_handle.updater() {
        Ok(u) => u,
        Err(e) => {
            error!("No se pudo obtener el servicio de updater: {}", e);
            emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            info!("Actualización del IDE encontrada: {}", version);

            if let Err(e) = open_update_window(&app_handle) {
                warn!("No se pudo abrir la ventana de actualización para el IDE: {}", e);
            }

            emit_progress(&app_handle, "ide", "downloading", Some(0.0), Some(0), None, Some(version.clone()), None);

            let downloaded = Arc::new(AtomicU64::new(0));
            let downloaded_clone = downloaded.clone();
            let progress_handle = app_handle.clone();
            let version_clone = version.clone();

            let install_result = update.download_and_install(
                move |chunk_len, total_len| {
                    let total = downloaded_clone.fetch_add(chunk_len as u64, Ordering::SeqCst) + chunk_len as u64;
                    let percent = total_len.map(|t| if t > 0 { (total as f64 / t as f64) * 100.0 } else { 0.0 });
                    emit_progress(&progress_handle, "ide", "downloading", percent, Some(total), total_len, Some(version_clone.clone()), None);
                },
                || {
                    info!("Descarga del IDE finalizada, instalando...");
                }
            ).await;

            match install_result {
                Ok(_) => {
                    emit_progress(&app_handle, "ide", "installing", Some(100.0), None, None, Some(version.clone()), None);
                    info!("IDE actualizado correctamente a {}", version);
                    emit_progress(&app_handle, "ide", "done", Some(100.0), None, None, Some(version), None);
                },
                Err(e) => {
                    error!("Error al instalar la actualización del IDE: {}", e);
                    emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
                }
            }
        },
        Ok(None) => {
            info!("El IDE está actualizado");
            emit_progress(&app_handle, "ide", "up_to_date", None, None, None, None, None);
        },
        Err(e) => {
            error!("Error al comprobar actualizaciones del IDE: {}", e);
            emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
        }
    }
}

pub fn run_cli_compiler_update(app_handle: tauri::AppHandle) {
    emit_progress(&app_handle, "cli", "checking", None, None, None, None, None);
    emit_progress(&app_handle, "compiler", "checking", None, None, None, None, None);

    thread::spawn(move || {
        let mut command = Command::new("chord");
        command.arg("update").arg("all").arg("--json");
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let spawn_res = command.spawn();

        match spawn_res {
            Ok(mut child) => {
                let stdout = child.stdout.take().expect("Fallo al capturar stdout");
                let reader = BufReader::new(stdout);

                for line in reader.lines() {
                    let Ok(l) = line else { continue; };
                    let trimmed = l.trim();
                    if trimmed.is_empty() { continue; }

                    match serde_json::from_str::<CliProgressLine>(trimmed) {
                        Ok(evt) if evt.tool == "cli" || evt.tool == "compiler" => {
                            emit_progress(
                                &app_handle,
                                &evt.tool,
                                &evt.phase,
                                evt.percent,
                                evt.current_bytes,
                                evt.total_bytes,
                                evt.version,
                                evt.message,
                            );
                        },
                        Ok(_) => {},
                        Err(_) => {
                            let clean_line = trimmed.replace("────────", "").trim().to_string();
                            if clean_line.is_empty() { continue; }

                            let lower = clean_line.to_lowercase();
                            let target = if lower.contains("compilador") { "compiler" } else { "cli" };
                            emit_progress(&app_handle, target, "downloading", None, None, None, None, Some(clean_line));
                        }
                    }
                }

                let status = child.wait();
                match status {
                    Ok(s) if s.success() => {
                        info!("Actualización de CLI/Compilador finalizada con éxito");
                    },
                    _ => {
                        warn!("'chord update all --json' terminó con un código no exitoso");
                    }
                }
            },
            Err(e) => {
                error!("Fallo al ejecutar 'chord update': {}", e);
                emit_progress(&app_handle, "cli", "error", None, None, None, None, Some(e.to_string()));
                emit_progress(&app_handle, "compiler", "error", None, None, None, None, Some(e.to_string()));
            }
        }
    });
}

#[tauri::command]
pub async fn start_full_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    open_update_window(&app_handle)?;

    let ide_handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        run_ide_update(ide_handle).await;
    });

    run_cli_compiler_update(app_handle);

    Ok(())
}

#[tauri::command]
pub fn run_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>, project_name: String) -> Result<(), String> {
    let mut project_dir = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    project_dir.push("DisChord-Workflows");
    project_dir.push(&project_name);

    let mut chord_file = project_dir.clone();
    chord_file.push("src");
    chord_file.push("index.chord");

    if !chord_file.exists() {
        error!("Fallo al ejecutar: No existe index.chord en {:?}", chord_file);
        return Err(format!("No se encontró el archivo: {:?}", chord_file));
    }

    info!("Iniciando ejecución del proyecto: {}", project_name);

    let mut command = Command::new("chord");
    command.current_dir(&project_dir);
    command.env("NODE_OPTIONS", "--experimental-default-type=module");

    if let Ok(path) = std::env::var("PATH") {
        command.env("PATH", path);
    }

    command.arg("run")
        .arg("src/index.chord")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(|e| {
        error!("No se pudo spawnear el proceso 'chord': {}", e);
        e.to_string()
    })?;

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
        let handle_out = handle_clone.clone();
        let stdout_thread = thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(l) = line {
                    let _ = handle_out.emit("terminal-data", format!("{}\r\n", l));
                }
            }
        });

        let handle_err = app_handle.clone();
        let stderr_thread = thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    let _ = handle_err.emit("terminal-data", format!("\x1b[31m{}\r\n\x1b[0m", l));
                }
            }
        });

        let _ = stdout_thread.join();
        let _ = stderr_thread.join();

        let mut lock = state_arc.lock().unwrap();
        if let Some(mut child) = lock.take() {
            let _ = child.wait();
            info!("El proceso hijo {} ha finalizado", pid);
        }

        let _ = handle_clone.emit("terminal-data", "\x1b[1;32m[!] Ejecución finalizada.\x1b[0m\r\n");
        *lock = None;
    });

    Ok(())
}

#[tauri::command]
pub fn stop_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>) -> Result<String, String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(mut child) = lock.take() {
        let pid = child.id();
        info!("Solicitud de detención para proceso PID: {}", pid);
        
        #[cfg(target_os = "windows")]
        {
            let res = Command::new("taskkill")
                .arg("/F")
                .arg("/T")
                .arg("/PID")
                .arg(pid.to_string())
                .creation_flags(0x08000000)
                .spawn();
            
            if res.is_err() {
                error!("Fallo al ejecutar taskkill para PID {}", pid);
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Err(e) = child.kill() {
                error!("Fallo al matar el proceso {}: {}", pid, e);
            }
        }

        let _ = app_handle.emit("terminal-data", "\x1b[1;31m[!] Proceso detenido.\x1b[0m\r\n");
        info!("Proceso {} detenido correctamente.", pid);
        Ok("Proceso detenido".into())
    } else {
        warn!("Se intentó detener un proceso, pero no hay ninguno activo");
        Err("No hay ningún proceso en ejecución".into())
    }
}

#[tauri::command]
pub fn open_in_explorer(app_handle: tauri::AppHandle, project_name: String) -> Result<(), String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);

    if !path.exists() {
        warn!("Intento de abrir explorador en ruta inexistente: {:?}", path);
        return Err("El proyecto no existe".to_string());
    }

    info!("Abriendo explorador de archivos en: {:?}", path);
    
    let cmd = if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&path).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(&path).spawn()
    } else {
        Command::new("xdg-open").arg(&path).spawn()
    };

    cmd.map_err(|e| {
        error!("Fallo al abrir el explorador: {}", e);
        e.to_string()
    })?;

    Ok(())
}

pub fn get_target_triple() -> &'static str {
    if cfg!(target_os = "windows") {
        "x86_64-pc-windows-msvc"
    } else if cfg!(target_os = "macos") {
        "aarch64-apple-darwin"
    } else {
        "x86_64-unknown-linux-gnu"
    }
}

pub fn download_tool(name: &str, dest: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let repo = if name == "chord" { "DischordCLI" } else { "DisChord" };
    let target = get_target_triple();
    let ext = if cfg!(windows) { ".exe" } else { "" };
    
    let url = format!(
        "https://github.com/DisChord-Org/{}/releases/latest/download/{}-{}{}",
        repo, name, target, ext
    );

    info!("Descargando herramienta: {} desde {}", name, url);
    
    let mut response = reqwest::blocking::get(url)?;
    if !response.status().is_success() {
        let err_msg = format!("Error de descarga (HTTP {}): {}", response.status(), name);
        error!("{}", err_msg);
        return Err(err_msg.into());
    }

    let mut file = fs::File::create(dest)?;
    response.copy_to(&mut file)?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(dest)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(dest, perms)?;
        debug!("Permisos 755 aplicados a {:?}", dest);
    }

    info!("Herramienta {} descargada correctamente en {:?}", name, dest);
    Ok(())
}

pub fn setup_environment(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    let home = handle.path().home_dir().expect("No se encontró el home dir");
    
    #[cfg(target_os = "windows")]
    let bin_dir = home.join(".dischord").join("bin");
    #[cfg(not(target_os = "windows"))]
    let bin_dir = home.join(".local").join("bin");

    if !bin_dir.exists() {
        info!("Creando directorio de binarios: {:?}", bin_dir);
        fs::create_dir_all(&bin_dir)?;
    }

    let tools = vec!["chord", "dischord-compiler"];
    for tool in tools {
        let tool_filename = if cfg!(windows) { format!("{}.exe", tool) } else { tool.to_string() };
        let dest_path = bin_dir.join(&tool_filename);
        
        if !dest_path.exists() {
            info!("Herramienta {} no encontrada. Iniciando descarga", tool);
            if let Err(e) = download_tool(tool, &dest_path) {
                error!("No se pudo preparar la herramienta {}: {}", tool, e);
            }
        } else {
            debug!("Herramienta {} existe en el sistema", tool);
        }
    }

    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (env, _) = hkcu.create_subkey("Environment")?;
        let current_path: String = env.get_value::<String, _>("Path").unwrap_or_default();
        let bin_dir_str = bin_dir.to_string_lossy().to_string();

        if !current_path.contains(&bin_dir_str) {
            info!("Añadiendo {:?} al PATH de Windows", bin_dir);
            let new_path = if current_path.is_empty() {
                bin_dir_str
            } else {
                format!("{};{}", current_path, bin_dir_str)
            };
            env.set_value("Path", &new_path)?;

            let paths = std::env::var_os("PATH").unwrap_or_default();
            let mut split_paths: Vec<_> = std::env::split_paths(&paths).collect();
            if !split_paths.contains(&bin_dir) {
                split_paths.push(bin_dir);
                let new_os_path = std::env::join_paths(split_paths)?;
                std::env::set_var("PATH", new_os_path);
            }

            unsafe {
                let env_str: Vec<u16> = "Environment\0".encode_utf16().collect();
                SendMessageTimeoutW(
                    HWND_BROADCAST as _,
                    WM_SETTINGCHANGE,
                    0,
                    env_str.as_ptr() as isize,
                    SMTO_ABORTIFHUNG,
                    5000,
                    std::ptr::null_mut(),
                );
            }
            
            info!("PATH actualizado y notificado al sistema.");
        }
    }

    Ok(())
}