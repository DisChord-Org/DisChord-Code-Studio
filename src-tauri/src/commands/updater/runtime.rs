use std::fs;
use std::io::Cursor;
use std::path::Path;

use serde::Deserialize;
use log::{info, warn, error};

use crate::platform;
use crate::log_err::LogErr;

const NODE_MAJOR: u32 = 22;
const PNPM_VERSION: &str = "12.6.0";

#[derive(Deserialize)]
struct NodeRelease {
    version: String,
    lts: serde_json::Value,
}

fn latest_lts_version() -> Result<String, String> {
    let releases: Vec<NodeRelease> = platform::download_client()
        .and_then(|c| c.get("https://nodejs.org/dist/index.json").send())
        .log_err("No se pudo consultar la lista de versiones de Node.js")?
        .json()
        .log_err("No se pudo interpretar la lista de versiones de Node.js")?;

    let prefix = format!("v{}.", NODE_MAJOR);
    releases.into_iter()
        .find(|r| r.version.starts_with(&prefix) && !matches!(r.lts, serde_json::Value::Bool(false)))
        .map(|r| r.version)
        .ok_or_else(|| format!("No se encontró ninguna versión LTS de Node {} disponible", NODE_MAJOR))
}

#[cfg(target_os = "windows")]
fn extract_archive(bytes: &[u8], root_entry: &str, dest: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).log_err("No se pudo abrir el archivo zip de Node.js")?;
    let prefix = format!("{}/", root_entry);

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).log_err("No se pudo leer una entrada del zip de Node.js")?;
        let name = file.name().strip_prefix(&prefix).unwrap_or(file.name());
        if name.is_empty() { continue; }

        let out_path = dest.join(name);
        if file.is_dir() {
            fs::create_dir_all(&out_path).log_err("No se pudo crear una carpeta al extraer Node.js")?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).log_err("No se pudo crear una carpeta al extraer Node.js")?;
            }
            let mut out_file = fs::File::create(&out_path).log_err("No se pudo crear un fichero al extraer Node.js")?;
            std::io::copy(&mut file, &mut out_file).log_err("No se pudo escribir un fichero al extraer Node.js")?;
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn extract_archive(bytes: &[u8], root_entry: &str, dest: &Path) -> Result<(), String> {
    use flate2::read::GzDecoder;

    let tar = GzDecoder::new(Cursor::new(bytes));
    let mut archive = tar::Archive::new(tar);

    for entry in archive.entries().log_err("No se pudo leer el archivo tar.gz de Node.js")? {
        let mut entry = entry.log_err("No se pudo leer una entrada del tar.gz de Node.js")?;
        let path = entry.path().log_err("No se pudo leer la ruta de una entrada del tar.gz de Node.js")?.into_owned();
        let relative = path.strip_prefix(root_entry).unwrap_or(&path);
        if relative.as_os_str().is_empty() { continue; }

        let out_path = dest.join(relative);
        if entry.header().entry_type().is_dir() {
            fs::create_dir_all(&out_path).log_err("No se pudo crear una carpeta al extraer Node.js")?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).log_err("No se pudo crear una carpeta al extraer Node.js")?;
            }
            entry.unpack(&out_path).log_err("No se pudo extraer un fichero de Node.js")?;
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

    let bytes = platform::download_client()
        .and_then(|c| c.get(&url).send())
        .log_err("No se pudo descargar Node.js")?
        .bytes()
        .log_err("No se pudo leer la descarga de Node.js")?;

    // Never install without verifying against the official SHASUMS256.txt of that release.
    let archive_file = format!("{}.{}", archive_name, ext);
    let sums_url = format!("https://nodejs.org/dist/{version}/SHASUMS256.txt");
    let sums = platform::download_client()
        .and_then(|c| c.get(&sums_url).send())
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.text())
        .log_err("No se pudo obtener SHASUMS256.txt de Node.js; no se instala sin verificar la integridad")?;
    let expected = platform::find_checksum(&sums, &archive_file)
        .ok_or_else(|| format!("SHASUMS256.txt no incluye {}; no se instala sin verificar la integridad", archive_file))?;
    if platform::sha256_hex(&bytes) != expected {
        // The download only lives in memory, so discarding it is just returning the error.
        error!("La suma SHA-256 de {} no coincide con la oficial", archive_file);
        return Err(format!("La descarga de Node.js está corrupta o fue alterada: la suma SHA-256 de {} no coincide con la oficial. Se descartó.", archive_file));
    }

    let staging = dir.with_file_name("node.installing");
    if staging.exists() {
        fs::remove_dir_all(&staging).log_err("No se pudo limpiar una instalación incompleta de Node.js")?;
    }
    fs::create_dir_all(&staging).log_err("No se pudo crear la carpeta temporal de Node.js")?;

    if let Err(e) = extract_archive(&bytes, &archive_name, &staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for entry in ["node", "npm", "npx"] {
            let p = staging.join("bin").join(entry);
            if p.exists() {
                let _ = fs::set_permissions(&p, fs::Permissions::from_mode(0o755));
            }
        }
    }

    activate_dir(&staging, &dir, "Node.js")?;

    info!("Node.js {} instalado en {:?}", version, dir);
    Ok(())
}

/// Installs the standalone pnpm from its GitHub release. Like Node.js, it is never installed
/// without verifying the archive against the SHA-256 GitHub computes for that release asset.
fn install_pnpm(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let dir = platform::pnpm_dir(app_handle).ok_or("No se pudo determinar la carpeta de pnpm")?;
    let asset = platform::pnpm_asset_name(std::env::consts::OS, std::env::consts::ARCH)?;
    let url = format!("https://github.com/pnpm/pnpm/releases/download/v{}/{}", PNPM_VERSION, asset);

    info!("Descargando pnpm {} desde {}", PNPM_VERSION, url);

    let bytes = platform::download_client()
        .and_then(|c| c.get(&url).send())
        .and_then(|r| r.error_for_status())
        .log_err("No se pudo descargar pnpm")?
        .bytes()
        .log_err("No se pudo leer la descarga de pnpm")?;

    let expected = platform::fetch_github_digest("pnpm/pnpm", &format!("tags/v{}", PNPM_VERSION), &asset)
        .ok_or_else(|| format!("GitHub no publica la suma SHA-256 de {}; no se instala sin verificar la integridad", asset))?;
    if platform::sha256_hex(&bytes) != expected {
        error!("La suma SHA-256 de {} no coincide con la publicada", asset);
        return Err(format!("La descarga de pnpm está corrupta o fue alterada: la suma SHA-256 de {} no coincide. Se descartó.", asset));
    }

    let staging = dir.with_file_name("pnpm.installing");
    if staging.exists() {
        fs::remove_dir_all(&staging).log_err("No se pudo limpiar una instalación incompleta de pnpm")?;
    }
    fs::create_dir_all(&staging).log_err("No se pudo crear la carpeta temporal de pnpm")?;

    // The pnpm archives have no root folder: `pnpm[.exe]` and `dist/` sit at the top.
    if let Err(e) = extract_archive(&bytes, "", &staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let p = staging.join("pnpm");
        if p.exists() {
            let _ = fs::set_permissions(&p, fs::Permissions::from_mode(0o755));
        }
    }

    activate_dir(&staging, &dir, "pnpm")?;
    info!("pnpm {} instalado en {:?}", PNPM_VERSION, dir);
    Ok(())
}

/// Swaps `staging` in as `dir`, keeping the previous folder until the swap worked so a
/// failure leaves the old install in place.
fn activate_dir(staging: &Path, dir: &Path, label: &str) -> Result<(), String> {
    let backup = dir.with_extension("old");
    let _ = fs::remove_dir_all(&backup);
    let had_previous = dir.exists();
    if had_previous {
        fs::rename(dir, &backup).log_err(&format!("No se pudo apartar la instalación anterior de {}", label))?;
    }
    if let Err(e) = fs::rename(staging, dir) {
        if had_previous {
            let _ = fs::rename(&backup, dir);
        }
        let _ = fs::remove_dir_all(staging);
        error!("No se pudo activar la nueva instalación de {}: {}", label, e);
        return Err(format!("No se pudo activar la nueva instalación de {}: {}", label, e));
    }
    let _ = fs::remove_dir_all(&backup);
    Ok(())
}

pub fn ensure_runtime(app_handle: tauri::AppHandle) {
    #[cfg(not(target_os = "windows"))]
    platform::migrate_legacy_node(&app_handle);

    let node_ready = platform::is_node_installed(&app_handle);
    let pnpm_ready = platform::is_pnpm_installed(&app_handle);

    if !node_ready || !pnpm_ready {
        if let Err(e) = super::window::open_update_window(&app_handle) {
            warn!("No se pudo abrir la ventana de actualización para el entorno de ejecución: {}", e);
        }
    }

    super::emit_progress(&app_handle, super::Progress::new("node", if node_ready { "up_to_date" } else { "checking" }));

    if !node_ready {
        super::emit_progress(&app_handle, super::Progress::new("node", "installing").message("Descargando Node.js..."));

        match install_node(&app_handle) {
            Ok(()) => super::emit_progress(&app_handle, super::Progress::new("node", "done")),
            Err(e) => super::emit_progress(&app_handle, super::Progress::new("node", "error").message(e)),
        }
    }

    // pnpm is standalone: it does not depend on Node.js being installed first.
    super::emit_progress(&app_handle, super::Progress::new("pnpm", if pnpm_ready { "up_to_date" } else { "checking" }));

    if !pnpm_ready {
        super::emit_progress(&app_handle, super::Progress::new("pnpm", "installing").message("Descargando pnpm..."));

        match install_pnpm(&app_handle) {
            Ok(()) => super::emit_progress(&app_handle, super::Progress::new("pnpm", "done")),
            Err(e) => super::emit_progress(&app_handle, super::Progress::new("pnpm", "error").message(e)),
        }
    }
}
