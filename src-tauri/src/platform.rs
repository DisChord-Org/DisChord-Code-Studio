use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::Manager;
use log::{info, error, debug};

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

const NPM_ENV_VARS_TO_STRIP: &[&str] = &[
    "COREPACK_ROOT",
    "COREPACK_ENABLE_STRICT",
    "COREPACK_ENABLE_AUTO_PIN",
    "COREPACK_ENABLE_NETWORK",
    "COREPACK_NPM_REGISTRY",
    "COREPACK_NPM_TOKEN",
    "npm_config_user_agent",
    "npm_execpath",
    "npm_node_execpath",
    "npm_config_prefix",
    "npm_config_global_prefix",
    "npm_package_json",
    "npm_lifecycle_event",
    "npm_lifecycle_script",
    "PNPM_HOME",
    "PNPM_SCRIPT_SRC_DIR",
];

pub fn strip_npm_env(cmd: &mut Command) {
    for var in NPM_ENV_VARS_TO_STRIP {
        cmd.env_remove(var);
    }
}

pub fn bin_dir(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let home = app_handle.path().home_dir().ok()?;

    #[cfg(target_os = "windows")]
    let dir = home.join(".dischord").join("bin");
    #[cfg(not(target_os = "windows"))]
    let dir = home.join(".local").join("bin");

    Some(dir)
}

pub fn chord_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = bin_dir(app_handle)?;
    let filename = if cfg!(windows) { "chord.exe" } else { "chord" };
    Some(dir.join(filename))
}

pub fn resolve_chord_command(app_handle: &tauri::AppHandle) -> Command {
    match chord_binary_path(app_handle).filter(|p| p.exists()) {
        Some(path) => silent_command(path),
        None => silent_command("chord"),
    }
}

pub fn compiler_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = bin_dir(app_handle)?;
    let filename = if cfg!(windows) { "dischord-compiler.exe" } else { "dischord-compiler" };
    Some(dir.join(filename))
}

pub fn looks_like_valid_binary(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else { return false };
    if metadata.len() < 1024 {
        return false;
    }

    #[cfg(target_os = "windows")]
    {
        use std::io::Read;
        let Ok(mut file) = fs::File::open(path) else { return false };
        let mut header = [0u8; 2];
        if file.read_exact(&mut header).is_err() {
            return false;
        }
        return &header == b"MZ";
    }

    #[cfg(not(target_os = "windows"))]
    {
        true
    }
}

pub fn node_dir(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(bin_dir(app_handle)?.join("node"))
}

pub fn build_path_env(app_handle: &tauri::AppHandle) -> Option<std::ffi::OsString> {
    let mut path_entries = Vec::new();
    if let Some(dir) = node_dir(app_handle) {
        path_entries.push(dir);
    }
    if let Some(system_path) = std::env::var_os("PATH") {
        path_entries.extend(std::env::split_paths(&system_path));
    }
    std::env::join_paths(path_entries).ok()
}

#[cfg(target_os = "windows")]
pub fn node_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(node_dir(app_handle)?.join("node.exe"))
}
#[cfg(not(target_os = "windows"))]
pub fn node_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(node_dir(app_handle)?.join("bin").join("node"))
}

#[cfg(target_os = "windows")]
pub fn npm_shim_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(node_dir(app_handle)?.join("npm.cmd"))
}
#[cfg(not(target_os = "windows"))]
pub fn npm_shim_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(node_dir(app_handle)?.join("bin").join("npm"))
}

#[cfg(target_os = "windows")]
fn pnpm_cjs_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(node_dir(app_handle)?.join("node_modules").join("pnpm").join("bin").join("pnpm.cjs"))
}
#[cfg(not(target_os = "windows"))]
fn pnpm_cjs_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(node_dir(app_handle)?.join("lib").join("node_modules").join("pnpm").join("bin").join("pnpm.cjs"))
}

pub fn pnpm_command(app_handle: &tauri::AppHandle) -> Option<Command> {
    let node = node_binary_path(app_handle)?;
    let cjs = pnpm_cjs_path(app_handle)?;
    if !node.exists() || !cjs.exists() {
        return None;
    }
    let mut cmd = silent_command(&node);
    cmd.arg(&cjs);
    strip_npm_env(&mut cmd);
    Some(cmd)
}

pub fn command_works(mut cmd: Command, label: &str) -> bool {
    use std::process::Stdio;
    match cmd.arg("--version").stdout(Stdio::piped()).stderr(Stdio::piped()).output() {
        Ok(output) if output.status.success() => true,
        Ok(output) => {
            debug!(
                "Comprobación de '{}' falló (código {:?}). stdout: {:?} | stderr: {:?}",
                label,
                output.status.code(),
                String::from_utf8_lossy(&output.stdout).trim(),
                String::from_utf8_lossy(&output.stderr).trim()
            );
            false
        }
        Err(e) => {
            debug!("No se pudo lanzar la comprobación de '{}': {}", label, e);
            false
        }
    }
}

pub fn is_node_installed(app_handle: &tauri::AppHandle) -> bool {
    match node_binary_path(app_handle) {
        Some(path) if path.exists() => command_works(silent_command(&path), "node"),
        _ => false,
    }
}

pub fn is_pnpm_installed(app_handle: &tauri::AppHandle) -> bool {
    match pnpm_command(app_handle) {
        Some(cmd) => command_works(cmd, "pnpm"),
        None => false,
    }
}

#[tauri::command]
pub fn get_platform() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

pub fn node_platform_id() -> &'static str {
    if cfg!(target_os = "windows") {
        if cfg!(target_arch = "aarch64") { "win-arm64" } else { "win-x64" }
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") { "darwin-arm64" } else { "darwin-x64" }
    } else if cfg!(target_arch = "aarch64") {
        "linux-arm64"
    } else {
        "linux-x64"
    }
}

#[cfg(target_os = "windows")]
pub fn shim_command(path: &Path) -> Command {
    let mut cmd = silent_command("cmd");
    cmd.arg("/C").arg(path);
    cmd
}
#[cfg(not(target_os = "windows"))]
pub fn shim_command(path: &Path) -> Command {
    silent_command(path)
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

    let tmp_dest = dest.with_extension("download");
    let mut file = fs::File::create(&tmp_dest)?;
    let copy_result = response.copy_to(&mut file);
    drop(file);

    if let Err(e) = copy_result {
        let _ = fs::remove_file(&tmp_dest);
        return Err(e.into());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&tmp_dest)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&tmp_dest, perms)?;
        debug!("Permisos 755 aplicados a {:?}", tmp_dest);
    }

    fs::rename(&tmp_dest, dest)?;

    info!("Herramienta {} descargada correctamente en {:?}", name, dest);
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn register_bin_dir_in_path(bin_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (env, _) = hkcu.create_subkey("Environment")?;

    let current_path: String = env.get_value("Path").unwrap_or_default();
    let value_type = env.get_raw_value("Path").map(|v| v.vtype).unwrap_or(REG_EXPAND_SZ);
    let bin_dir_str = bin_dir.to_string_lossy().to_string();

    let already_present = current_path
        .split(';')
        .map(str::trim)
        .any(|entry| entry.eq_ignore_ascii_case(&bin_dir_str));

    if already_present {
        return Ok(());
    }

    info!("Añadiendo {:?} al PATH de Windows", bin_dir);
    let new_path = if current_path.is_empty() {
        bin_dir_str
    } else {
        format!("{};{}", current_path.trim_end_matches(';'), bin_dir_str)
    };

    let bytes: Vec<u8> = new_path
        .encode_utf16()
        .chain(std::iter::once(0))
        .flat_map(|unit| unit.to_le_bytes())
        .collect();
    env.set_raw_value("Path", &winreg::RegValue { bytes, vtype: value_type })?;

    let paths = std::env::var_os("PATH").unwrap_or_default();
    let mut split_paths: Vec<_> = std::env::split_paths(&paths).collect();
    if !split_paths.iter().any(|p| p == bin_dir) {
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
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn register_bin_dir_in_path(_bin_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
