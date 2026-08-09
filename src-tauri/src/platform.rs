use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::Manager;
use log::{info, error};
#[cfg(unix)]
use log::debug;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn silent_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

pub fn bin_dir(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let home = app_handle.path().home_dir().ok()?;

    #[cfg(target_os = "windows")]
    let dir = home.join(".dischord").join("bin");
    #[cfg(not(target_os = "windows"))]
    let dir = home.join(".local").join("bin");

    Some(dir)
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

#[cfg(target_os = "windows")]
pub fn register_bin_dir_in_path(bin_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
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
        if !split_paths.contains(&bin_dir.to_path_buf()) {
            split_paths.push(bin_dir.to_path_buf());
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

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn register_bin_dir_in_path(_bin_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
