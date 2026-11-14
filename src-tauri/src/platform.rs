use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
#[cfg(not(target_os = "windows"))]
use std::time::Duration;

use tauri::Manager;
use log::{info, warn, error, debug};
use sha2::{Digest, Sha256};

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
    #[cfg_attr(not(target_os = "windows"), allow(unused_mut))]
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(target_os = "windows"))]
const KILL_GRACE_PERIOD: Duration = Duration::from_secs(2);

pub const NPM_ENV_VARS_TO_STRIP: &[&str] = &[
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
    Some(if cfg!(windows) { home.join(".dischord").join("bin") } else { home.join(".local").join("bin") })
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
        &header == b"MZ"
    }

    // Mach-O (32/64 bit, big/little endian) or a universal ("fat") binary.
    #[cfg(target_os = "macos")]
    {
        use std::io::Read;
        const MACHO_MAGICS: [[u8; 4]; 6] = [
            [0xFE, 0xED, 0xFA, 0xCE],
            [0xFE, 0xED, 0xFA, 0xCF],
            [0xCE, 0xFA, 0xED, 0xFE],
            [0xCF, 0xFA, 0xED, 0xFE],
            [0xCA, 0xFE, 0xBA, 0xBE],
            [0xBE, 0xBA, 0xFE, 0xCA],
        ];
        let Ok(mut file) = fs::File::open(path) else { return false };
        let mut header = [0u8; 4];
        if file.read_exact(&mut header).is_err() {
            return false;
        }
        return MACHO_MAGICS.contains(&header);
    }

    // ELF.
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::io::Read;
        let Ok(mut file) = fs::File::open(path) else { return false };
        let mut header = [0u8; 4];
        if file.read_exact(&mut header).is_err() {
            return false;
        }
        &header == b"\x7FELF"
    }
}

/// Node.js folder. On Windows it stays inside `~/.dischord/bin`; on Unix it has its
/// own folder so it never shares `~/.local/bin` (which also holds the user's binaries).
pub fn node_dir(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    if cfg!(windows) {
        Some(bin_dir(app_handle)?.join("node"))
    } else {
        let home = app_handle.path().home_dir().ok()?;
        Some(unix_node_dir(&home))
    }
}

fn unix_node_dir(home: &Path) -> PathBuf {
    home.join(".local").join("share").join("dischord").join("node")
}

/// folder where Unix versions prior to the move kept Node.js (`~/.local/bin/node`).
#[cfg_attr(windows, allow(dead_code))]
fn legacy_node_dir(home: &Path) -> PathBuf {
    home.join(".local").join("bin").join("node")
}

/// One-time migration of Node.js from `~/.local/bin/node` to its own folder (Unix only).
/// Only a *directory* named `node` is touched; a loose `node` binary is never moved.
#[cfg(not(target_os = "windows"))]
pub fn migrate_legacy_node(app_handle: &tauri::AppHandle) {
    let Ok(home) = app_handle.path().home_dir() else { return };
    match migrate_dir(&legacy_node_dir(&home), &unix_node_dir(&home)) {
        Ok(true) => info!("Node.js migrado a {:?}", unix_node_dir(&home)),
        Ok(false) => {}
        Err(e) => warn!("No se pudo migrar la instalación antigua de Node.js: {}", e),
    }
}

/// Moves `old` to `new` if `old` is a directory and `new` does not exist.
/// Returns whether a migration happened.
#[cfg_attr(windows, allow(dead_code))]
fn migrate_dir(old: &Path, new: &Path) -> std::io::Result<bool> {
    if !old.is_dir() || fs::symlink_metadata(new).is_ok() {
        return Ok(false);
    }
    if let Some(parent) = new.parent() {
        fs::create_dir_all(parent)?;
    }
    if fs::rename(old, new).is_ok() {
        return Ok(true);
    }
    // rename fails across devices: copy and then remove the original.
    #[cfg(unix)]
    {
        if let Err(e) = copy_dir_recursive(old, new) {
            let _ = fs::remove_dir_all(new);
            return Err(e);
        }
        fs::remove_dir_all(old)?;
        Ok(true)
    }
    #[cfg(not(unix))]
    {
        Err(std::io::Error::other("no se pudo mover la carpeta"))
    }
}

#[cfg(unix)]
fn copy_dir_recursive(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_symlink() {
            std::os::unix::fs::symlink(fs::read_link(entry.path())?, &target)?;
        } else if kind.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

fn node_exec_dir(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = node_dir(app_handle)?;
    Some(if cfg!(windows) { dir } else { dir.join("bin") })
}

pub fn build_path_env(app_handle: &tauri::AppHandle) -> Option<std::ffi::OsString> {
    let mut path_entries = Vec::new();
    if let Some(dir) = bin_dir(app_handle) {
        path_entries.push(dir);
    }
    if let Some(dir) = pnpm_dir(app_handle) {
        path_entries.push(dir);
    }
    if let Some(dir) = node_exec_dir(app_handle) {
        path_entries.push(dir);
    }
    if let Some(system_path) = std::env::var_os("PATH") {
        path_entries.extend(std::env::split_paths(&system_path));
    }
    std::env::join_paths(path_entries).ok()
}

pub fn node_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = node_dir(app_handle)?;
    Some(if cfg!(windows) { dir.join("node.exe") } else { dir.join("bin").join("node") })
}

/// Folder of the standalone pnpm. Same layout rule as Node.js: inside `~/.dischord/bin` on
/// Windows, its own folder on Unix so it never mixes with the user's `~/.local/bin`.
pub fn pnpm_dir(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    if cfg!(windows) {
        Some(bin_dir(app_handle)?.join("pnpm"))
    } else {
        let home = app_handle.path().home_dir().ok()?;
        Some(home.join(".local").join("share").join("dischord").join("pnpm"))
    }
}

pub fn pnpm_binary_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    Some(pnpm_dir(app_handle)?.join(if cfg!(windows) { "pnpm.exe" } else { "pnpm" }))
}

/// Name of the standalone pnpm archive published in the GitHub release for an OS and
/// architecture (`std::env::consts` values). It is a `.zip` on Windows and `.tar.gz` elsewhere.
pub fn pnpm_asset_name(os: &str, arch: &str) -> Result<String, String> {
    let (os_part, ext) = match os {
        "windows" => ("win32", "zip"),
        "macos" => ("darwin", "tar.gz"),
        "linux" => ("linux", "tar.gz"),
        _ => return Err(format!("No hay un pnpm independiente para {}-{}.", os, arch)),
    };
    let arch_part = match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        _ => return Err(format!("No hay un pnpm independiente para {}-{}.", os, arch)),
    };
    Ok(format!("pnpm-{}-{}.{}", os_part, arch_part, ext))
}

/// The standalone pnpm needs no Node.js: it is a native launcher with its `dist/` next to it.
pub fn pnpm_command(app_handle: &tauri::AppHandle) -> Option<Command> {
    let binary = pnpm_binary_path(app_handle)?;
    if !binary.exists() {
        return None;
    }
    let mut cmd = silent_command(&binary);
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

/// Platforms with a published `chord` binary. Mac Intel and Linux ARM are out of scope on purpose.
pub fn get_target_triple() -> Result<&'static str, String> {
    if cfg!(target_os = "windows") && cfg!(target_arch = "x86_64") {
        Ok("x86_64-pc-windows-msvc")
    } else if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
        Ok("aarch64-apple-darwin")
    } else if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
        Ok("x86_64-unknown-linux-gnu")
    } else {
        Err(format!(
            "No hay un binario de chord para esta plataforma ({}-{}).",
            std::env::consts::OS,
            std::env::consts::ARCH
        ))
    }
}

pub fn write_atomic(path: &Path, contents: impl AsRef<[u8]>) -> std::io::Result<()> {
    let mut tmp_name = path.file_name().map(|n| n.to_os_string()).unwrap_or_default();
    tmp_name.push(".tmp");
    let tmp = path.with_file_name(tmp_name);
    if let Err(e) = fs::write(&tmp, contents).and_then(|_| fs::rename(&tmp, path)) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn sha256_file(path: &Path) -> std::io::Result<String> {
    let mut hasher = Sha256::new();
    std::io::copy(&mut fs::File::open(path)?, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

fn is_sha256_hex(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}

/// Looks up the SHA-256 of `filename` in a `sha256sum`-style listing (`<hash>  <name>`,
/// optionally `<hash> *<name>`). If the text is a single bare hash (a `.sha256`
/// sidecar), that hash is returned. The result is lowercase.
pub fn find_checksum(text: &str, filename: &str) -> Option<String> {
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    if let [only] = lines.as_slice() {
        if is_sha256_hex(only) {
            return Some(only.to_ascii_lowercase());
        }
    }
    lines.iter().find_map(|line| {
        let mut parts = line.split_whitespace();
        let hash = parts.next()?;
        let name = parts.next()?.trim_start_matches('*');
        (is_sha256_hex(hash) && name == filename && parts.next().is_none())
            .then(|| hash.to_ascii_lowercase())
    })
}

/// Blocking HTTP client for downloads: bounded connect and total time so a stalled server cannot hang an update.
pub fn download_client() -> reqwest::Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(600))
        .build()
}

pub fn digest_from_release(json: &str, filename: &str) -> Option<String> {
    let release: serde_json::Value = serde_json::from_str(json).ok()?;
    release.get("assets")?.as_array()?.iter().find_map(|asset| {
        if asset.get("name")?.as_str()? != filename {
            return None;
        }
        let hash = asset.get("digest")?.as_str()?.strip_prefix("sha256:")?;
        is_sha256_hex(hash).then(|| hash.to_ascii_lowercase())
    })
}

/// SHA-256 GitHub computes for an asset of `owner/repo`; `release` is `latest` or `tags/<tag>`.
pub fn fetch_github_digest(repo_path: &str, release: &str, filename: &str) -> Option<String> {
    let url = format!("https://api.github.com/repos/{}/releases/{}", repo_path, release);
    let response = download_client().ok()?
        .get(url)
        .header(reqwest::header::USER_AGENT, "dischord-code-studio")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send().ok()?;
    if !response.status().is_success() {
        return None;
    }
    digest_from_release(&response.text().ok()?, filename)
}

fn fetch_text(url: &str) -> Option<String> {
    let response = download_client().ok()?.get(url).send().ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.text().ok()
}

pub fn download_tool(name: &str, dest: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let repo = if name == "chord" { "DischordCLI" } else { "DisChord" };
    let target = get_target_triple()?;
    let ext = if cfg!(windows) { ".exe" } else { "" };

    let url = format!(
        "https://github.com/DisChord-Org/{}/releases/latest/download/{}-{}{}",
        repo, name, target, ext
    );

    info!("Descargando herramienta: {} desde {}", name, url);

    let mut response = download_client()?.get(&url).send()?;
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

    // Expected hash: a checksum published next to the binary, or else the digest GitHub computes
    // for the release asset. When neither is available we only warn; once one is, it is
    // mandatory and a mismatch aborts the install.
    let filename = format!("{}-{}{}", name, target, ext);
    let base = url.rsplit_once('/').map(|(b, _)| b).unwrap_or(&url).to_string();
    let expected = [format!("{}.sha256", url), format!("{}/SHA256SUMS", base), format!("{}/checksums.txt", base)]
        .iter()
        .find_map(|u| fetch_text(u).and_then(|t| find_checksum(&t, &filename)))
        .or_else(|| fetch_github_digest(&format!("DisChord-Org/{}", repo), "latest", &filename));
    match expected {
        Some(expected) => {
            let actual = sha256_file(&tmp_dest).inspect_err(|_| {
                let _ = fs::remove_file(&tmp_dest);
            })?;
            if actual != expected {
                let _ = fs::remove_file(&tmp_dest);
                let msg = format!("La suma SHA-256 de {} no coincide con la publicada; se descartó la descarga.", name);
                error!("{} (esperada {}, obtenida {})", msg, expected, actual);
                return Err(msg.into());
            }
            info!("SHA-256 de {} verificado", name);
        }
        None => warn!("No hay checksum publicado para {}: se instala sin verificar integridad", name),
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
pub fn register_bin_dir_in_path(bin_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return Ok(());
    };

    const MARKER: &str = "# Añadido por DisChord Code Studio";
    let bin_dir_str = bin_dir.to_string_lossy();
    let export_block = format!("\n{}\nexport PATH=\"{}:$PATH\"\n", MARKER, bin_dir_str);

    let shell = std::env::var("SHELL").unwrap_or_default();
    let profiles: Vec<PathBuf> = if shell.contains("zsh") {
        vec![home.join(".zshrc"), home.join(".zprofile")]
    } else if shell.contains("bash") {
        vec![home.join(".bash_profile"), home.join(".bashrc")]
    } else {
        vec![home.join(".profile")]
    };

    for profile in profiles {
        let existing = fs::read_to_string(&profile).unwrap_or_default();
        if existing.contains(MARKER) {
            continue;
        }

        let mut contents = existing;
        if !contents.is_empty() && !contents.ends_with('\n') {
            contents.push('\n');
        }
        contents.push_str(&export_block);

        fs::write(&profile, contents)?;
        info!("PATH actualizado en {:?}", profile);
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub fn default_shell() -> String {
    "powershell.exe".to_string()
}
#[cfg(not(target_os = "windows"))]
pub fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}

#[cfg(target_os = "windows")]
pub fn open_in_file_manager(path: &Path) -> std::io::Result<Child> {
    silent_command("explorer").arg(path).spawn()
}
#[cfg(target_os = "macos")]
pub fn open_in_file_manager(path: &Path) -> std::io::Result<Child> {
    silent_command("open").arg(path).spawn()
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn open_in_file_manager(path: &Path) -> std::io::Result<Child> {
    silent_command("xdg-open").arg(path).spawn()
}

#[cfg(target_os = "windows")]
pub fn isolate_process_group(_command: &mut Command) {}
#[cfg(not(target_os = "windows"))]
pub fn isolate_process_group(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
}

#[cfg(target_os = "windows")]
pub fn terminate_process_tree(child: &mut Child) {
    let pid = child.id();
    let res = silent_command("taskkill").arg("/F").arg("/T").arg("/PID").arg(pid.to_string()).spawn();
    if res.is_err() {
        error!("Fallo al ejecutar taskkill para PID {}", pid);
        let _ = child.kill();
    }
}

#[cfg(not(target_os = "windows"))]
pub fn terminate_process_tree(child: &mut Child) {
    let group = child.id() as libc::pid_t;
    unsafe { libc::killpg(group, libc::SIGTERM) };
    std::thread::spawn(move || {
        std::thread::sleep(KILL_GRACE_PERIOD);
        unsafe { libc::killpg(group, libc::SIGKILL) };
    });
}

#[cfg(test)]
mod tests;
