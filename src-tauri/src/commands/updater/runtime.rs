use std::fs;
use std::io::Cursor;
use std::path::Path;

use serde::Deserialize;
use log::{info, warn, error};

use crate::platform;

const NODE_MAJOR: u32 = 22;

#[derive(Deserialize)]
struct NodeRelease {
    version: String,
    lts: serde_json::Value,
}

fn latest_lts_version() -> Result<String, String> {
    let releases: Vec<NodeRelease> = reqwest::blocking::get("https://nodejs.org/dist/index.json")
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())?;

    let prefix = format!("v{}.", NODE_MAJOR);
    releases.into_iter()
        .find(|r| r.version.starts_with(&prefix) && !matches!(r.lts, serde_json::Value::Bool(false)))
        .map(|r| r.version)
        .ok_or_else(|| format!("No se encontró ninguna versión LTS de Node {} disponible", NODE_MAJOR))
}

#[cfg(target_os = "windows")]
fn extract_archive(bytes: &[u8], root_entry: &str, dest: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let prefix = format!("{}/", root_entry);

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().strip_prefix(&prefix).unwrap_or(file.name());
        if name.is_empty() { continue; }

        let out_path = dest.join(name);
        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out_file).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn extract_archive(bytes: &[u8], root_entry: &str, dest: &Path) -> Result<(), String> {
    use flate2::read::GzDecoder;

    let tar = GzDecoder::new(Cursor::new(bytes));
    let mut archive = tar::Archive::new(tar);

    for entry in archive.entries().map_err(|e| e.to_string())? {
        let mut entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path().map_err(|e| e.to_string())?.into_owned();
        let relative = path.strip_prefix(root_entry).unwrap_or(&path);
        if relative.as_os_str().is_empty() { continue; }

        let out_path = dest.join(relative);
        if entry.header().entry_type().is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            entry.unpack(&out_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn install_node(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let dir = platform::node_dir(app_handle).ok_or("No se pudo determinar la carpeta de Node.js")?;

    let version = latest_lts_version()?;
    let platform_id = platform::node_platform_id();
    let ext = if cfg!(windows) { "zip" } else { "tar.gz" };
    let archive_name = format!("node-{}-{}", version, platform_id);
    let url = format!("https://nodejs.org/dist/{version}/{archive_name}.{ext}");

    info!("Descargando Node.js {} desde {}", version, url);

    let bytes = reqwest::blocking::get(&url)
        .map_err(|e| e.to_string())?
        .bytes()
        .map_err(|e| e.to_string())?;

    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    extract_archive(&bytes, &archive_name, &dir)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for entry in ["node", "npm", "npx"] {
            let p = dir.join("bin").join(entry);
            if p.exists() {
                let _ = fs::set_permissions(&p, fs::Permissions::from_mode(0o755));
            }
        }
    }

    info!("Node.js {} instalado en {:?}", version, dir);
    Ok(())
}

fn install_pnpm(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let npm = platform::npm_shim_path(app_handle).ok_or("No se pudo localizar npm")?;
    if !npm.exists() {
        return Err("npm no está disponible (¿Node.js instalado correctamente?)".into());
    }
    let install_dir = platform::node_dir(app_handle).ok_or("No se pudo determinar la carpeta de Node.js")?;

    let stale_candidates = [
        install_dir.join("pnpm"),
        install_dir.join("pnpm.cmd"),
        install_dir.join("pnpm.ps1"),
        install_dir.join("pnpx"),
        install_dir.join("pnpx.cmd"),
        install_dir.join("pnpx.ps1"),
        install_dir.join("bin").join("pnpm"),
        install_dir.join("bin").join("pnpx"),
    ];
    for stale in stale_candidates {
        if fs::symlink_metadata(&stale).is_ok() {
            let _ = fs::remove_file(&stale);
        }
    }

    info!("Instalando pnpm vía npm");
    let mut cmd = platform::shim_command(&npm);
    cmd.arg("install")
        .arg("-g")
        .arg("pnpm")
        .arg("--prefix")
        .arg(&install_dir);
    platform::strip_npm_env(&mut cmd);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let output = cmd.output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if !stderr.trim().is_empty() { stderr.trim() } else { stdout.trim() };
        error!("'npm install -g pnpm' falló: {}", detail);
        return Err(format!("'npm install -g pnpm' falló: {}", detail));
    }

    Ok(())
}

pub fn ensure_runtime(app_handle: tauri::AppHandle) {
    let node_ready = platform::is_node_installed(&app_handle);
    let pnpm_already_ready = node_ready && platform::is_pnpm_installed(&app_handle);

    if !node_ready || !pnpm_already_ready {
        if let Err(e) = super::window::open_update_window(&app_handle) {
            warn!("No se pudo abrir la ventana de actualización para el entorno de ejecución: {}", e);
        }
    }

    super::emit_progress(&app_handle, "node", if node_ready { "up_to_date" } else { "checking" }, None, None, None, None, None);

    if !node_ready {
        super::emit_progress(&app_handle, "node", "installing", None, None, None, None,
            Some("Descargando Node.js...".into()));

        if let Err(e) = install_node(&app_handle) {
            super::emit_progress(&app_handle, "node", "error", None, None, None, None, Some(e.clone()));
            super::emit_progress(&app_handle, "pnpm", "error", None, None, None, None,
                Some("No se pudo instalar porque Node.js falló".into()));
            return;
        }

        super::emit_progress(&app_handle, "node", "done", None, None, None, None, None);
    }

    let pnpm_ready = platform::is_pnpm_installed(&app_handle);
    super::emit_progress(&app_handle, "pnpm", if pnpm_ready { "up_to_date" } else { "checking" }, None, None, None, None, None);

    if !pnpm_ready {
        super::emit_progress(&app_handle, "pnpm", "installing", None, None, None, None,
            Some("Instalando pnpm...".into()));

        match install_pnpm(&app_handle) {
            Ok(()) => super::emit_progress(&app_handle, "pnpm", "done", None, None, None, None, None),
            Err(e) => super::emit_progress(&app_handle, "pnpm", "error", None, None, None, None, Some(e)),
        }
    }
}
