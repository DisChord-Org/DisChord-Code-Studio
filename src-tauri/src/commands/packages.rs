use std::fs;
use std::process::Command;

use log::{error, info, warn};
use serde::Serialize;

use crate::log_err::LogErr;
use crate::paths::project_path;
use crate::platform::{build_path_env, resolve_chord_command, strip_npm_env};

#[derive(Serialize, Clone)]
pub struct PackageEntry {
    pub name: String,
    pub latest_version: String,
    pub description: String,
    pub repo: Option<String>,
    pub tags: Vec<String>,
    pub versions: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct ProjectLibrary {
    pub name: String,
    pub version: String,
}

#[derive(Serialize)]
pub struct PkgOpOutcome {
    pub success: bool,
    pub output: String,
}

fn normalize_version(version: &str) -> String {
    let trimmed = version.trim();
    if trimmed.starts_with('v') {
        trimmed.to_string()
    } else {
        format!("v{}", trimmed)
    }
}

fn configure_pkg_command(app_handle: &tauri::AppHandle, command: &mut Command) {
    strip_npm_env(command);
    if let Some(path) = build_path_env(app_handle) {
        command.env("PATH", path);
    }
}

fn parse_search_output(stdout: &str) -> Vec<PackageEntry> {
    let lines: Vec<&str> = stdout.lines().collect();
    let mut entries = Vec::new();
    let mut i = 0;

    while i < lines.len() {
        let header = lines[i].trim();

        let Some(rest) = header.strip_prefix("+ ") else {
            i += 1;
            continue;
        };

        let Some((name_and_version, description)) = rest.split_once(" - ") else {
            i += 1;
            continue;
        };

        let (name, latest_version) = match name_and_version.split_once(" (v") {
            Some((n, v)) => (n.trim().to_string(), format!("v{}", v.trim_end_matches(')').trim())),
            None => (name_and_version.trim().to_string(), String::new()),
        };

        let mut repo = None;
        let mut tags = Vec::new();
        let mut versions = Vec::new();

        i += 1;
        while i < lines.len() {
            let line = lines[i].trim();

            if line.is_empty() || line.starts_with("+ ") {
                break;
            }

            if let Some(value) = line.strip_prefix("- ") {
                if value.eq_ignore_ascii_case("versiones:") {
                    i += 1;
                    if i < lines.len() {
                        versions = lines[i].split_whitespace().map(str::to_string).collect();
                    }
                    i += 1;
                    break;
                } else if repo.is_none() && value.contains('/') {
                    repo = Some(value.to_string());
                } else {
                    tags.push(value.to_string());
                }
            }

            i += 1;
        }

        entries.push(PackageEntry { name, latest_version, description: description.trim().to_string(), repo, tags, versions });
    }

    entries
}

#[tauri::command]
pub fn pkg_search(app_handle: tauri::AppHandle, query: Option<String>, installed_only: bool) -> Result<Vec<PackageEntry>, String> {
    let mut command = resolve_chord_command(&app_handle);
    configure_pkg_command(&app_handle, &mut command);
    command.arg("pkg").arg("search");

    if installed_only {
        command.arg("-i");
    }
    if let Some(query) = query.filter(|q| !q.trim().is_empty()) {
        command.arg(query);
    }

    let output = command.output().log_err("No se pudo ejecutar 'chord pkg search'")?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    if stdout.trim().starts_with("- Sin resultados") {
        return Ok(vec![]);
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() };
        error!("'chord pkg search' falló: {}", message);
        return Err(message.to_string());
    }

    Ok(parse_search_output(&stdout))
}

#[tauri::command]
pub fn list_project_libraries(app_handle: tauri::AppHandle, project_name: String) -> Result<Vec<ProjectLibrary>, String> {
    let lib_dir = project_path(&app_handle, &project_name).join("lib");

    if !lib_dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&lib_dir).log_err("No se pudo leer la carpeta lib/ del proyecto")?;
    let mut libraries = Vec::new();

    for entry in entries.flatten() {
        let package_json = entry.path().join("package.json");
        if !package_json.exists() {
            continue;
        }

        let Ok(text) = fs::read_to_string(&package_json) else { continue };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { continue };

        let fallback_name = entry.file_name().to_string_lossy().to_string();
        let name = json.get("name").and_then(|v| v.as_str()).unwrap_or(&fallback_name).to_string();
        let raw_version = json.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string();

        libraries.push(ProjectLibrary { name, version: normalize_version(&raw_version) });
    }

    Ok(libraries)
}

fn ensure_lib_gitignored(project_dir: &std::path::Path) {
    let gitignore_path = project_dir.join(".gitignore");
    let Ok(existing) = fs::read_to_string(&gitignore_path) else { return };

    if existing.lines().any(|line| line.trim() == "lib") {
        return;
    }

    let mut updated = existing;
    if !updated.is_empty() && !updated.ends_with('\n') {
        updated.push('\n');
    }
    updated.push_str("lib\n");

    if let Err(e) = fs::write(&gitignore_path, updated) {
        warn!("No se pudo añadir 'lib' a {:?}: {}", gitignore_path, e);
    }
}

fn run_pkg_op(app_handle: &tauri::AppHandle, args: &[&str], cwd: Option<&std::path::Path>, context: &str) -> Result<PkgOpOutcome, String> {
    let mut command = resolve_chord_command(app_handle);
    configure_pkg_command(app_handle, &mut command);
    command.arg("pkg").args(args);

    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    let output = command.output().log_err(context)?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = [stdout, stderr].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join("\n");

    if output.status.success() {
        info!("{}: éxito ({})", context, args.join(" "));
    } else {
        warn!("{}: falló ({}) -> {}", context, args.join(" "), combined);
    }

    Ok(PkgOpOutcome { success: output.status.success(), output: combined })
}

#[tauri::command]
pub fn pkg_install(app_handle: tauri::AppHandle, name: String, version: String) -> Result<PkgOpOutcome, String> {
    let target = format!("{}@{}", name, normalize_version(&version));
    run_pkg_op(&app_handle, &["install", &target], None, "No se pudo ejecutar 'chord pkg install'")
}

#[tauri::command]
pub fn pkg_uninstall(app_handle: tauri::AppHandle, name: String, version: String) -> Result<PkgOpOutcome, String> {
    let version = normalize_version(&version);
    run_pkg_op(&app_handle, &["uninstall", &name, &version], None, "No se pudo ejecutar 'chord pkg uninstall'")
}

#[tauri::command]
pub fn pkg_use(app_handle: tauri::AppHandle, project_name: String, name: String, version: String) -> Result<PkgOpOutcome, String> {
    let version = normalize_version(&version);
    let project_dir = project_path(&app_handle, &project_name);
    let outcome = run_pkg_op(&app_handle, &["use", &name, &version], Some(&project_dir), "No se pudo ejecutar 'chord pkg use'")?;

    if outcome.success {
        ensure_lib_gitignored(&project_dir);
    }

    Ok(outcome)
}

#[tauri::command]
pub fn pkg_unuse(app_handle: tauri::AppHandle, project_name: String, name: String) -> Result<PkgOpOutcome, String> {
    let project_dir = project_path(&app_handle, &project_name);
    run_pkg_op(&app_handle, &["unuse", &name], Some(&project_dir), "No se pudo ejecutar 'chord pkg unuse'")
}
