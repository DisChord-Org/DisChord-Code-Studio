use std::fs;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use std::path::Path;

use tauri::Manager;
use tauri::Emitter;
use tauri::State;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::ChildProcessState;

#[tauri::command]
pub fn run_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>, project_name: String) -> Result<(), String> {
    let mut project_dir = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    project_dir.push("DisChord-Workflows");
    project_dir.push(&project_name);

    let mut chord_file = project_dir.clone();
    chord_file.push("src");
    chord_file.push("index.chord");

    if !chord_file.exists() {
        return Err(format!("No se encontró el archivo: {:?}", chord_file));
    }

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

    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().expect("Fallo stdout");
    let stderr = child.stderr.take().expect("Fallo stderr");

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

        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .arg("/F")
                .arg("/T")
                .arg("/PID")
                .arg(pid.to_string())
                .creation_flags(0x08000000)
                .spawn();
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = child.kill();
        }

        let _ = app_handle.emit("terminal-data", "\x1b[1;31m[!] Proceso detenido.\x1b[0m\r\n");
        Ok("Proceso detenido".into())
    } else {
        Err("No hay ningún proceso en ejecución".into())
    }
}

#[tauri::command]
pub async fn update_chord_system(app_handle: tauri::AppHandle) -> Result<(), String> {
    thread::spawn(move || {
        let mut child = Command::new("chord")
            .arg("update")
            .arg("all")
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())
            .expect("Fallo al iniciar el comando de actualización");

        let stdout = child.stdout.take().expect("Fallo al capturar stdout");
        let reader = BufReader::new(stdout);

        for line in reader.lines() {
            if let Ok(l) = line {
                let clean_line = l.trim().replace("────────", "").trim().to_string();
                if !clean_line.is_empty() {
                    let _ = app_handle.emit("update-status", clean_line);
                }
            }
        }
        
        let _ = child.wait();
        let _ = app_handle.emit("update-finished", "success");
    });

    Ok(())
}

#[tauri::command]
pub fn open_in_explorer(app_handle: tauri::AppHandle, project_name: String) -> Result<(), String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);

    if !path.exists() {
        return Err("El proyecto no existe".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(path).spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(path).spawn().map_err(|e| e.to_string())?;
    }

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

    println!("Descargando {} desde {}...", name, url);
    
    let mut response = reqwest::blocking::get(url)?;
    if !response.status().is_success() {
        return Err(format!("Fallo al descargar: {}", response.status()).into());
    }

    let mut file = fs::File::create(dest)?;
    response.copy_to(&mut file)?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(dest)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(dest, perms)?;
    }

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
        fs::create_dir_all(&bin_dir)?;
    }

    let tools = vec!["chord", "dischord-compiler"];
    for tool in tools {
        let tool_filename = if cfg!(windows) { format!("{}.exe", tool) } else { tool.to_string() };
        let dest_path = bin_dir.join(&tool_filename);
        
        if !dest_path.exists() {
            if let Err(e) = download_tool(tool, &dest_path) {
                eprintln!("Error descargando {}: {}", tool, e);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (env, _) = hkcu.create_subkey("Environment")?;
        let current_path: String = env.get_value::<String, _>("Path").unwrap_or_default();
        let bin_dir_str = bin_dir.to_string_lossy().to_string();

        if !current_path.contains(&bin_dir_str) {
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
        }
    }

    Ok(())
}