// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use tauri::Manager;
use std::process::{Command, Stdio, Child};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::Emitter;
use std::sync::{Arc, Mutex};
use tauri::State;

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

#[tauri::command]
fn get_projects(app_handle: tauri::AppHandle) -> Vec<String> {
    let mut path = app_handle.path().document_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    path.push("DisChord-Workflows");

    let mut projects = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        projects.push(name.to_string());
                    }
                }
            }
        }
    }
    projects
}

#[tauri::command]
fn create_new_project(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let chord_check = Command::new("chord")
        .arg("-v")
        .output();

    if chord_check.is_err() {
        return Err("El comando 'chord' no está instalado en tu sistema Debian.".into());
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

    fn scan_dir(path: &std::path::Path, root_str: &str) -> Vec<ProjectFile> {
        let mut files = Vec::new();
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                let is_dir = file_path.is_dir();
                
                let relative_path = file_path.to_string_lossy()
                    .replace(root_str, "")
                    .trim_start_matches('/')
                    .to_string();

                files.push(ProjectFile {
                    name: entry.file_name().to_string_lossy().to_string(),
                    is_dir,
                    relative_path,
                    children: if is_dir { Some(scan_dir(&file_path, root_str)) } else { None },
                });
            }
        }
        files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir));
        files
    }

    Ok(scan_dir(&root_path, &root_str))
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

fn main() {
    tauri::Builder::default()
        .manage(ChildProcessState(Arc::new(Mutex::new(None))))
        .plugin(tauri_plugin_opener::init())
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
            stop_chord_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    dischord_code_studio_lib::run()
}