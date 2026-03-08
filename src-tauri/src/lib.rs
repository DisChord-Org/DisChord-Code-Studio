use std::fs;
use std::process::{Command, Stdio, Child};
use std::io::{BufRead, BufReader};
use std::thread;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use std::path::Path;

use tauri::Manager;
use tauri::Emitter;
use tauri::State;

use serde::Serialize;
use ignore::gitignore::GitignoreBuilder;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};

pub struct ChildProcessState(pub Arc<Mutex<Option<Child>>>);

#[tauri::command]
fn create_projects_folder(app_handle: tauri::AppHandle) -> String {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");

    if !path.exists() {
        fs::create_dir_all(&path).unwrap();
    }
    "done".into()
}

#[derive(Serialize)]
struct ProjectInfo {
    name: String,
    last_modified: String,
}

fn get_latest_modification(path: &Path) -> SystemTime {
    let mut latest = fs::metadata(path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            let mtime = if entry_path.is_dir() {
                get_latest_modification(&entry_path)
            } else {
                fs::metadata(&entry_path)
                    .and_then(|m| m.modified())
                    .unwrap_or(SystemTime::UNIX_EPOCH)
            };

            if mtime > latest {
                latest = mtime;
            }
        }
    }
    latest
}

#[tauri::command]
fn get_projects(app_handle: tauri::AppHandle) -> Vec<ProjectInfo> {
    let mut root_path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    root_path.push("DisChord-Workflows");

    let mut projects = Vec::new();

    if let Ok(entries) = fs::read_dir(root_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                let last_modified_time = get_latest_modification(&path);
                let datetime: chrono::DateTime<chrono::Local> = last_modified_time.into();
                let formatted_time = datetime.to_rfc3339(); 

                projects.push(ProjectInfo {
                    name,
                    last_modified: formatted_time,
                });
            }
        }
    }
    
    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    projects
}

#[tauri::command]
fn create_new_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let chord_check = Command::new("chord")
        .arg("-v")
        .output();

    if chord_check.is_err() {
        return Err("El comando 'chord' no está instalado en tu sistema.".into());
    }

    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(&name);

    if path.exists() {
        return Err("El proyecto ya existe".into());
    }

    // se supone que 'chord init <path>' ya crea la carpeta, próximamente será necesario usar esto 
    /*if let Err(e) = fs::create_dir_all(&path) {
        return Err(format!("Error al crear la carpeta: {}", e));
    }*/

    let init_status = Command::new("chord")
        .arg("init")
        .arg(&path)
        .status();

    match init_status {
        Ok(s) if s.success() => Ok(format!("Proyecto '{}' creado", name)),
        Ok(_) => Err("'chord init' falló. Revisa los permisos de la carpeta.".into()),
        Err(e) => Err(format!("Error al ejecutar chord init: {}", e)),
    }
}

#[derive(Serialize)]
struct ProjectFile {
    name: String,
    is_dir: bool,
    relative_path: String,
    children: Option<Vec<ProjectFile>>,
}

#[tauri::command]
fn read_project_files(app_handle: tauri::AppHandle, name: String) -> Result<Vec<ProjectFile>, String> {
    let mut root_path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    root_path.push("DisChord-Workflows");
    root_path.push(&name);
    
    let root_str = root_path.to_string_lossy().to_string();
    let mut builder = GitignoreBuilder::new(&root_path);
    let gitignore_path = root_path.join(".gitignore");
    if gitignore_path.exists() {
        let _ = builder.add(&gitignore_path);
    }
    let matcher = builder.build().unwrap();

    fn scan_dir(path: &Path, root_str: &str, matcher: &ignore::gitignore::Gitignore) -> Vec<ProjectFile> {
        let mut files = Vec::new();

        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if file_name == ".gitignore" || file_name == ".git" {
                    continue;
                }

                if matcher.matched(&file_path, file_path.is_dir()).is_ignore() {
                    continue;
                }

                let is_dir = file_path.is_dir();
                let relative_path = file_path.to_string_lossy()
                    .replace(root_str, "")
                    .trim_start_matches(|c| c == '/' || c == '\\')
                    .to_string();

                files.push(ProjectFile {
                    name: file_name,
                    is_dir,
                    relative_path,
                    children: if is_dir { 
                        Some(scan_dir(&file_path, root_str, matcher)) 
                    } else { 
                        None 
                    },
                });
            }
        }

        files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
        files
    }

    Ok(scan_dir(&root_path, &root_str, &matcher))
}

#[tauri::command]
fn read_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(file_path);

    fs::read_to_string(&path).map_err(|e| format!("No se pudo leer el archivo: {}", e))
}

#[tauri::command]
fn save_file_content(app_handle: tauri::AppHandle, project_name: String, file_path: String, content: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(file_path);

    fs::write(&path, content).map_err(|e| format!("Error al guardar: {}", e))?;
    Ok("Archivo guardado".into())
}

#[tauri::command]
fn create_new_file(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(parent_path);
    path.push(name);

    if path.exists() {
        return Err("El archivo ya existe".into());
    }

    fs::write(&path, "").map_err(|e| format!("Error al crear el archivo: {}", e))?;
    Ok("Archivo creado".into())
}

#[tauri::command]
fn create_new_folder(app_handle: tauri::AppHandle, project_name: String, parent_path: String, name: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(project_name);
    path.push(parent_path);
    path.push(name);

    if path.exists() {
        return Err("La carpeta ya existe".into());
    }

    fs::create_dir_all(&path).map_err(|e| format!("Error al crear la carpeta: {}", e))?;
    Ok("Carpeta creada".into())
}

#[tauri::command]
fn delete_item(app_handle: tauri::AppHandle, project_name: String, path: String) -> Result<String, String> {
    let mut full_path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    full_path.push("DisChord-Workflows");
    full_path.push(project_name);
    full_path.push(path);

    if !full_path.exists() {
        return Err("El elemento no existe".into());
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    }

    Ok("Eliminado correctamente".into())
}

#[tauri::command]
fn delete_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");
    path.push(&name);

    if path.exists() && path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| format!("Error al borrar proyecto: {}", e))?;
        Ok("Proyecto eliminado".into())
    } else {
        Err("El proyecto no existe".into())
    }
}

#[tauri::command]
fn run_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>, project_name: String) -> Result<(), String> {
    let mut project_dir = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    project_dir.push("DisChord-Workflows");
    project_dir.push(&project_name);

    let mut chord_file = project_dir.clone();
    chord_file.push("src");
    chord_file.push("index.chord");

    if !chord_file.exists() {
        return Err(format!("No se encontró el archivo: {:?}", chord_file));
    }

    let mut child = Command::new("chord")
        .arg("run")
        .arg("src/index.chord")
        .current_dir(&project_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().expect("Fallo stdout");
    let stderr = child.stderr.take().expect("Fallo stderr");

    {
        let mut lock = state.0.lock().unwrap();
        *lock = Some(child);
    }

    let state_arc = state.0.clone(); 

    thread::spawn(move || {
        let handle_out = app_handle.clone();
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

        let _ = app_handle.emit("terminal-data", "\x1b[1;32m[!] Ejecución finalizada.\x1b[0m\r\n");

        let mut lock = state_arc.lock().unwrap();
        *lock = None;
    });

    Ok(())
}

#[tauri::command]
fn stop_chord_project(app_handle: tauri::AppHandle, state: State<'_, ChildProcessState>) -> Result<String, String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(mut child) = lock.take() {
        child.kill().map_err(|e| e.to_string())?;
        let _ = app_handle.emit("terminal-data", "\x1b[1;31m[!] Proceso detenido.\x1b[0m\r\n");
        Ok("Proceso detenido".into())
    } else {
        Err("No hay ningún proceso en ejecución".into())
    }
}

#[tauri::command]
async fn update_chord_system(app_handle: tauri::AppHandle) -> Result<(), String> {
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
fn open_in_explorer(app_handle: tauri::AppHandle, project_name: String) -> Result<(), String> {
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

fn get_target_triple() -> &'static str {
    if cfg!(target_os = "windows") {
        "x86_64-pc-windows-msvc"
    } else if cfg!(target_os = "macos") {
        "aarch64-apple-darwin"
    } else {
        "x86_64-unknown-linux-gnu"
    }
}

fn download_tool(name: &str, dest: &Path) -> Result<(), Box<dyn std::error::Error>> {
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

fn setup_environment(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if let Err(e) = setup_environment(app) {
                eprintln!("Error instalando herramientas: {}", e);
            }
            Ok(())
        })
        .manage(ChildProcessState(Arc::new(Mutex::new(None))))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            create_projects_folder,
            get_projects,
            create_new_project,
            read_project_files,
            read_file_content,
            save_file_content,
            create_new_file,
            create_new_folder,
            delete_item,
            delete_project,
            run_chord_project,
            stop_chord_project,
            update_chord_system,
            open_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
