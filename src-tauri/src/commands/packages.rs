use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Stdio;

use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::log_err::LogErr;
use crate::paths::project_path;
use crate::platform::{build_path_env, resolve_chord_command, strip_npm_env};

#[derive(Deserialize)]
struct RawVersionInfo {
    #[serde(rename = "isAudited")]
    is_audited: bool,
    #[serde(rename = "downloadUrl")]
    download_url: String,
    #[serde(rename = "createdAt")]
    created_at: i64,
}

#[derive(Deserialize)]
struct RawPackageEntry {
    name: String,
    description: String,
    #[serde(rename = "trustLevel")]
    trust_level: i32,
    repository: String,
    version: String,
    #[serde(rename = "isAudited")]
    is_audited: bool,
    versions: HashMap<String, RawVersionInfo>,
}

#[derive(Serialize, Clone)]
pub struct PackageVersion {
    pub tag: String,
    pub is_audited: bool,
    pub download_url: String,
    pub created_at: i64,
}

#[derive(Serialize, Clone)]
pub struct PackageEntry {
    pub name: String,
    pub description: String,
    pub trust_level: i32,
    pub repository: String,
    pub latest_version: String,
    pub is_audited: bool,
    pub versions: Vec<PackageVersion>,
}

impl From<RawPackageEntry> for PackageEntry {
    fn from(raw: RawPackageEntry) -> Self {
        let mut versions: Vec<PackageVersion> = raw
            .versions
            .into_iter()
            .map(|(tag, info)| PackageVersion {
                tag,
                is_audited: info.is_audited,
                download_url: info.download_url,
                created_at: info.created_at,
            })
            .collect();
        versions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        PackageEntry {
            name: raw.name,
            description: raw.description,
            trust_level: raw.trust_level,
            repository: raw.repository,
            latest_version: raw.version,
            is_audited: raw.is_audited,
            versions,
        }
    }
}

#[derive(Serialize, Clone)]
pub struct ProjectLibrary {
    pub name: String,
    pub version: String,
}

fn normalize_version(version: &str) -> String {
    let trimmed = version.trim();
    if trimmed.starts_with('v') {
        trimmed.to_string()
    } else {
        format!("v{}", trimmed)
    }
}

fn configure_pkg_command(app_handle: &tauri::AppHandle, command: &mut std::process::Command) {
    strip_npm_env(command);
    if let Some(path) = build_path_env(app_handle) {
        command.env("PATH", path);
    }
}

fn pkg_search_blocking(app_handle: &tauri::AppHandle, query: Option<String>, installed_only: bool) -> Result<Vec<PackageEntry>, String> {
    let mut command = resolve_chord_command(app_handle);
    configure_pkg_command(app_handle, &mut command);
    command.arg("pkg").arg("search").arg("--json");

    if installed_only {
        command.arg("-i");
    }
    if let Some(query) = query.filter(|q| !q.trim().is_empty()) {
        command.arg(query);
    }

    let output = command.output().log_err("No se pudo ejecutar 'chord pkg search'")?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() };
        error!("'chord pkg search' falló: {}", message);
        return Err(message.to_string());
    }

    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let raw: Vec<RawPackageEntry> = serde_json::from_str(trimmed)
        .map_err(|e| format!("No se pudo interpretar la respuesta de 'chord pkg search': {}", e))?;

    Ok(raw.into_iter().map(PackageEntry::from).collect())
}

#[tauri::command]
pub async fn pkg_search(app_handle: tauri::AppHandle, query: Option<String>, installed_only: bool) -> Result<Vec<PackageEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || pkg_search_blocking(&app_handle, query, installed_only))
        .await
        .map_err(|e| e.to_string())?
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

fn ensure_lib_gitignored(project_dir: &Path) {
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

#[derive(Deserialize)]
struct PkgLine {
    package: String,
    #[serde(default)]
    version: Option<String>,
    phase: String,
    #[serde(default)]
    percent: Option<f64>,
    #[serde(default)]
    current_bytes: Option<u64>,
    #[serde(default)]
    total_bytes: Option<u64>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    path: Option<String>,
}

#[derive(Serialize, Clone)]
struct PkgProgressPayload {
    op: String,
    package: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
}

#[derive(Serialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Info,
    Success,
    Error,
}

#[derive(Serialize, Clone)]
pub struct PkgResult {
    pub package: String,
    pub version: Option<String>,
    pub phase: String,
    pub message: Option<String>,
    pub severity: Severity,
    pub warned: bool,
}

#[derive(Serialize)]
pub struct PkgOpOutcome {
    pub success: bool,
    pub changed: bool,
    pub output: String,
    pub results: Vec<PkgResult>,
}

fn phase_severity(op: &str, phase: &str) -> Option<Severity> {
    match phase {
        "done" | "linked" | "synced" | "uninstalled" | "unlinked" => Some(Severity::Success),
        "already_installed" | "already_linked" | "not_linked" | "version_not_installed" => Some(Severity::Info),
        "not_installed" if op == "uninstall" => Some(Severity::Info),
        "not_installed" | "not_found" | "invalid_signature" | "error" => Some(Severity::Error),
        _ => None,
    }
}

fn summarize(op: &str, root: Option<&str>, events: &[PkgLine], exit_ok: bool) -> PkgOpOutcome {
    let mut results: Vec<PkgResult> = Vec::new();

    for event in events {
        let severity = phase_severity(op, &event.phase);

        let index = match results.iter().position(|r| r.package == event.package) {
            Some(index) => index,
            None => {
                results.push(PkgResult {
                    package: event.package.clone(),
                    version: None,
                    phase: event.phase.clone(),
                    message: None,
                    severity: Severity::Info,
                    warned: false,
                });
                results.len() - 1
            }
        };
        let result = &mut results[index];

        result.phase = event.phase.clone();
        if event.version.is_some() {
            result.version = event.version.clone();
        }
        if event.phase == "unsigned" {
            result.warned = true;
        }

        if let Some(severity) = severity {
            result.severity = result.severity.max(severity);

            if event.message.is_some() && (severity == Severity::Error || result.severity != Severity::Error) {
                result.message = event.message.clone();
            }
        }
    }

    let reached_outcome = |name: &str| {
        events.iter().any(|e| e.package == name && phase_severity(op, &e.phase).is_some_and(|s| s != Severity::Error))
    };

    let any_error = results.iter().any(|r| r.severity == Severity::Error);
    let root_done = root.is_none_or(reached_outcome);
    let success = exit_ok && !any_error && root_done;

    let changed = results.iter().any(|r| r.severity == Severity::Success);

    let output = results
        .iter()
        .map(|r| match &r.message {
            Some(msg) => format!("{}: {}", r.package, msg),
            None => format!("{}: {}", r.package, r.phase),
        })
        .collect::<Vec<_>>()
        .join("\n");

    PkgOpOutcome { success, changed, output, results }
}

fn run_pkg_json_op(
    app_handle: &tauri::AppHandle,
    op: &str,
    args: &[&str],
    cwd: Option<&Path>,
    root: Option<&str>,
    context: &str,
) -> Result<PkgOpOutcome, String> {
    let mut command = resolve_chord_command(app_handle);
    configure_pkg_command(app_handle, &mut command);
    command.arg("pkg").args(args).arg("--json");
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    let mut child = command.spawn().log_err(context)?;
    let stdout = child.stdout.take().expect("Fallo al capturar stdout de chord pkg");
    let reader = BufReader::new(stdout);

    let mut events: Vec<PkgLine> = Vec::new();

    for line in reader.lines() {
        let Ok(line) = line else { continue };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(evt) = serde_json::from_str::<PkgLine>(trimmed) else {
            warn!("{}: línea NDJSON no reconocida: {}", context, trimmed);
            continue;
        };

        let _ = app_handle.emit(
            "pkg-progress",
            PkgProgressPayload {
                op: op.to_string(),
                package: evt.package.clone(),
                version: evt.version.clone(),
                phase: evt.phase.clone(),
                percent: evt.percent,
                current_bytes: evt.current_bytes,
                total_bytes: evt.total_bytes,
                message: evt.message.clone(),
                path: evt.path.clone(),
            },
        );

        events.push(evt);
    }

    let exit_ok = matches!(child.wait(), Ok(status) if status.success());
    let outcome = summarize(op, root, &events, exit_ok);

    if outcome.success {
        info!("{}: éxito ({})", context, args.join(" "));
    } else {
        warn!("{}: falló ({}) -> {}", context, args.join(" "), outcome.output);
    }

    Ok(outcome)
}

#[tauri::command]
pub async fn pkg_install(app_handle: tauri::AppHandle, name: String, version: String) -> Result<PkgOpOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = format!("{}@{}", name, normalize_version(&version));
        run_pkg_json_op(&app_handle, "install", &["install", &target], None, Some(&name), "No se pudo ejecutar 'chord pkg install'")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pkg_uninstall(app_handle: tauri::AppHandle, name: String, version: String) -> Result<PkgOpOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = normalize_version(&version);
        run_pkg_json_op(&app_handle, "uninstall", &["uninstall", &name, &version], None, Some(&name), "No se pudo ejecutar 'chord pkg uninstall'")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pkg_use(app_handle: tauri::AppHandle, project_name: String, name: String, version: String) -> Result<PkgOpOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = normalize_version(&version);
        let project_dir = project_path(&app_handle, &project_name);
        let outcome = run_pkg_json_op(&app_handle, "use", &["use", &name, &version], Some(&project_dir), Some(&name), "No se pudo ejecutar 'chord pkg use'")?;

        if outcome.success {
            ensure_lib_gitignored(&project_dir);
        }

        Ok(outcome)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pkg_unuse(app_handle: tauri::AppHandle, project_name: String, name: String) -> Result<PkgOpOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let project_dir = project_path(&app_handle, &project_name);
        run_pkg_json_op(&app_handle, "unuse", &["unuse", &name], Some(&project_dir), Some(&name), "No se pudo ejecutar 'chord pkg unuse'")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pkg_sync(app_handle: tauri::AppHandle, project_name: String) -> Result<PkgOpOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let project_dir = project_path(&app_handle, &project_name);
        let outcome = run_pkg_json_op(&app_handle, "sync", &["sync"], Some(&project_dir), None, "No se pudo ejecutar 'chord pkg sync'")?;

        if outcome.success {
            ensure_lib_gitignored(&project_dir);
        }

        Ok(outcome)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(package: &str, phase: &str, message: Option<&str>) -> PkgLine {
        PkgLine {
            package: package.into(),
            version: Some("v1.0.0".into()),
            phase: phase.into(),
            percent: None,
            current_bytes: None,
            total_bytes: None,
            message: message.map(String::from),
            path: None,
        }
    }

    #[test]
    fn installing_a_package_with_dependencies_is_a_success() {
        let events = vec![
            line("ent", "checking", None),
            line("ent", "downloading", None),
            line("ent", "installing_deps", None),
            line("sf", "checking", None),
            line("sf", "done", None),
            line("sf", "linked", None),
            line("sf", "synced", None),
            line("procesos", "already_linked", None),
            line("ent", "compiling", None),
            line("ent", "done", None),
        ];

        let outcome = summarize("install", Some("ent"), &events, true);

        assert!(outcome.success);
        assert!(outcome.changed);
        assert!(outcome.results.iter().all(|r| r.severity != Severity::Error));
        assert_eq!(outcome.results.iter().find(|r| r.package == "procesos").unwrap().severity, Severity::Info);
    }

    #[test]
    fn something_already_installed_is_a_success_that_changed_nothing() {
        let outcome = summarize("install", Some("ent"), &[line("ent", "already_installed", None)], true);

        assert!(outcome.success);
        assert!(!outcome.changed);
    }

    #[test]
    fn a_failed_dependency_fails_the_install_even_if_it_ends_in_synced() {
        let events = vec![
            line("sf", "error", Some("No se pudo descargar")),
            line("sf", "not_installed", None),
            line("sf", "synced", None),
            line("ent", "done", None),
        ];

        let outcome = summarize("install", Some("ent"), &events, true);
        let sf = outcome.results.iter().find(|r| r.package == "sf").unwrap();

        assert!(!outcome.success);
        assert_eq!(sf.severity, Severity::Error);
        assert_eq!(sf.message.as_deref(), Some("No se pudo descargar"));
    }

    #[test]
    fn an_install_whose_root_never_finishes_fails() {
        let events = vec![line("ent", "checking", None), line("ent", "downloading", None)];

        assert!(!summarize("install", Some("ent"), &events, true).success);
    }

    #[test]
    fn a_crash_fails_even_without_an_error_event() {
        assert!(!summarize("install", Some("ent"), &[line("ent", "done", None)], false).success);
    }

    #[test]
    fn an_unsigned_package_installs_with_a_warning() {
        let events = vec![line("ent", "unsigned", Some("El paquete no está firmado")), line("ent", "done", None)];

        let outcome = summarize("install", Some("ent"), &events, true);

        assert!(outcome.success);
        assert!(outcome.results[0].warned);
    }

    #[test]
    fn removing_what_is_not_there_is_not_an_error() {
        let uninstall = summarize("uninstall", Some("ent"), &[line("ent", "not_installed", Some("No instalado"))], true);
        let unuse = summarize("unuse", Some("ent"), &[line("ent", "not_linked", None)], true);
        let version = summarize("uninstall", Some("ent"), &[line("ent", "version_not_installed", None)], true);

        for outcome in [uninstall, unuse, version] {
            assert!(outcome.success);
            assert!(!outcome.changed);
        }
    }

    #[test]
    fn using_what_is_not_installed_is_an_error() {
        let outcome = summarize("use", Some("ent"), &[line("ent", "not_installed", Some("ent@v1 no está instalada."))], true);

        assert!(!outcome.success);
    }

    #[test]
    fn the_happy_paths_of_the_other_operations() {
        assert!(summarize("uninstall", Some("ent"), &[line("ent", "uninstalled", None)], true).changed);
        assert!(summarize("use", Some("ent"), &[line("ent", "linked", None)], true).changed);
        assert!(summarize("unuse", Some("ent"), &[line("ent", "unlinked", None)], true).changed);
    }

    #[test]
    fn syncing_nothing_succeeds_without_changing_anything() {
        let outcome = summarize("sync", None, &[], true);

        assert!(outcome.success);
        assert!(!outcome.changed);
    }
}