//! Keeps the editor's file tree in sync with the disk, the way VS Code's explorer does: an OS
//! file watcher (inotify / FSEvents / ReadDirectoryChanges through the `notify` crate) with a
//! short debounce, ignoring `.git`, `node_modules` and anything the project's `.gitignore`
//! excludes (so build output or installed dependencies don't cause constant refreshes).
//!
//! Directories are watched one by one (non-recursive) instead of recursing over the whole
//! project: a recursive watch would also register every folder inside `node_modules`, which can
//! exhaust the OS's watch limit on Linux.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use ignore::WalkBuilder;
use log::{info, warn};
use notify::{EventKind, RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, DebouncedEvent, Debouncer, RecommendedCache};
use tauri::Emitter;

use crate::commands::file::build_gitignore_matcher;
use crate::log_err::LogErr;
use crate::paths::resolve_in_project;

type Watcher = Debouncer<RecommendedWatcher, RecommendedCache>;

struct ActiveWatch {
    // Dropping the debouncer stops the watch.
    _debouncer: Arc<Mutex<Watcher>>,
}

#[derive(Default)]
pub struct WatcherState(Mutex<Option<ActiveWatch>>);

const DEBOUNCE_MS: u64 = 250;

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

const ALWAYS_IGNORED: [&str; 2] = [".git", "node_modules"];

fn is_always_ignored(path: &Path) -> bool {
    path.components().any(|c| ALWAYS_IGNORED.iter().any(|name| c.as_os_str() == *name))
}

/// The directory itself plus every sub-directory that isn't ignored.
fn collect_dirs(root: &Path) -> Vec<PathBuf> {
    WalkBuilder::new(root)
        .hidden(false)
        .require_git(false)
        .git_global(false)
        .filter_entry(|entry| !ALWAYS_IGNORED.iter().any(|name| entry.file_name() == *name))
        .build()
        .flatten()
        .filter(|entry| entry.file_type().is_some_and(|t| t.is_dir()))
        .map(|entry| entry.into_path())
        .collect()
}

fn relevant_changes(root: &Path, events: &[DebouncedEvent]) -> Vec<PathBuf> {
    let candidates: Vec<PathBuf> = events
        .iter()
        .filter(|event| !matches!(event.kind, EventKind::Access(_) | EventKind::Other))
        .flat_map(|event| event.paths.iter().cloned())
        .filter(|path| !is_always_ignored(path))
        .collect();

    if candidates.is_empty() {
        return candidates;
    }

    let matcher = build_gitignore_matcher(root).ok();
    candidates
        .into_iter()
        .filter(|path| !matcher.as_ref().is_some_and(|m| m.matched(path, path.is_dir()).is_ignore()))
        .collect()
}

fn watch_dir(debouncer: &Arc<Mutex<Watcher>>, watched: &Arc<Mutex<HashSet<PathBuf>>>, dir: PathBuf) {
    if !lock(watched).insert(dir.clone()) {
        return;
    }
    if let Err(e) = lock(debouncer).watch(&dir, RecursiveMode::NonRecursive) {
        warn!("No se pudo vigilar {:?}: {}", dir, e);
    }
}

#[tauri::command]
pub fn watch_project(app_handle: tauri::AppHandle, state: tauri::State<'_, WatcherState>, project_name: String) -> Result<(), String> {
    let root = resolve_in_project(&app_handle, &project_name, "")?;
    if !root.is_dir() {
        return Err(format!("La carpeta del proyecto no existe: {:?}", root));
    }

    let watched: Arc<Mutex<HashSet<PathBuf>>> = Arc::new(Mutex::new(HashSet::new()));
    let debouncer_slot: Arc<Mutex<Option<Arc<Mutex<Watcher>>>>> = Arc::new(Mutex::new(None));

    let handler = {
        let app_handle = app_handle.clone();
        let root = root.clone();
        let project_name = project_name.clone();
        let watched = watched.clone();
        let debouncer_slot = debouncer_slot.clone();

        move |result: DebounceEventResult| {
            let Ok(events) = result else { return };

            let changes = relevant_changes(&root, &events);
            if changes.is_empty() {
                return;
            }

            for path in &changes {
                if !path.exists() {
                    // A removed folder loses its OS watch; forget it so it's re-watched if it comes back.
                    lock(&watched).retain(|dir| !dir.starts_with(path));
                } else if path.is_dir() {
                    if let Some(debouncer) = lock(&debouncer_slot).as_ref() {
                        for dir in collect_dirs(path) {
                            watch_dir(debouncer, &watched, dir);
                        }
                    }
                }
            }

            let _ = app_handle.emit("project-files-changed", project_name.clone());
        }
    };

    let debouncer = Arc::new(Mutex::new(
        new_debouncer(Duration::from_millis(DEBOUNCE_MS), None, handler).log_err("No se pudo crear el vigilante de ficheros")?,
    ));
    *lock(&debouncer_slot) = Some(debouncer.clone());

    for dir in collect_dirs(&root) {
        watch_dir(&debouncer, &watched, dir);
    }

    info!("Vigilando cambios en el proyecto '{}'", project_name);
    // Replacing the previous watch drops (and so stops) it.
    *lock(&state.0) = Some(ActiveWatch { _debouncer: debouncer });
    Ok(())
}

#[tauri::command]
pub fn unwatch_project(state: tauri::State<'_, WatcherState>) {
    *lock(&state.0) = None;
}
