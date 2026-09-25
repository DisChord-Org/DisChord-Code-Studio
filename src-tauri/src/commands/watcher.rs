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
use crate::paths::project_path;

type Watcher = Debouncer<RecommendedWatcher, RecommendedCache>;

struct ActiveWatch {
    // Dropping the debouncer stops the watch.
    _debouncer: Arc<Mutex<Watcher>>,
}

#[derive(Default)]
pub struct WatcherState(Mutex<Option<ActiveWatch>>);

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

/// Paths in a batch that are a real change (created, modified, renamed, removed) and not
/// ignored. Two traps here, both of which used to make the watcher fire forever:
///  - reading a file or listing a folder raises access events, so those never count;
///  - building the .gitignore matcher *reads the .gitignore*, i.e. raises access events itself,
///    so it is only built when there is a real candidate to check. A batch made only of access
///    events must end here without touching the disk.
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
    if !watched.lock().unwrap().insert(dir.clone()) {
        return;
    }
    if let Err(e) = debouncer.lock().unwrap().watch(&dir, RecursiveMode::NonRecursive) {
        warn!("No se pudo vigilar {:?}: {}", dir, e);
    }
}

#[tauri::command]
pub fn watch_project(app_handle: tauri::AppHandle, state: tauri::State<'_, WatcherState>, project_name: String) -> Result<(), String> {
    let root = project_path(&app_handle, &project_name);
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
                    watched.lock().unwrap().retain(|dir| !dir.starts_with(path));
                } else if path.is_dir() {
                    if let Some(debouncer) = debouncer_slot.lock().unwrap().as_ref() {
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
        new_debouncer(Duration::from_millis(250), None, handler).map_err(|e| e.to_string())?,
    ));
    *debouncer_slot.lock().unwrap() = Some(debouncer.clone());

    for dir in collect_dirs(&root) {
        watch_dir(&debouncer, &watched, dir);
    }

    info!("Vigilando cambios en el proyecto '{}'", project_name);
    // Replacing the previous watch drops (and so stops) it.
    *state.0.lock().unwrap() = Some(ActiveWatch { _debouncer: debouncer });
    Ok(())
}

#[tauri::command]
pub fn unwatch_project(state: tauri::State<'_, WatcherState>) {
    *state.0.lock().unwrap() = None;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn temp_project(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dischord-watcher-test-{}-{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn collect_dirs_skips_node_modules_and_git() {
        let root = temp_project("collect");
        for sub in ["src", "src/events", "node_modules/pkg", ".git/objects"] {
            std::fs::create_dir_all(root.join(sub)).unwrap();
        }

        let dirs = collect_dirs(&root);
        assert!(dirs.contains(&root));
        assert!(dirs.contains(&root.join("src")));
        assert!(dirs.contains(&root.join("src/events")));
        assert!(!dirs.iter().any(|d| d.components().any(|c| c.as_os_str() == "node_modules" || c.as_os_str() == ".git")));

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn creating_a_file_produces_a_debounced_event() {
        let root = temp_project("events");
        let (tx, rx) = mpsc::channel();
        let mut debouncer = new_debouncer(Duration::from_millis(100), None, move |result: DebounceEventResult| {
            let _ = tx.send(result);
        })
        .unwrap();
        debouncer.watch(&root, RecursiveMode::NonRecursive).unwrap();

        std::fs::write(root.join("test.chord"), "hola").unwrap();

        let events = rx.recv_timeout(Duration::from_secs(5)).expect("no event").expect("watch error");
        assert!(events.iter().any(|e| e.paths.iter().any(|p| p.ends_with("test.chord"))));

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn reading_files_does_not_produce_change_events() {
        // Regression: refreshing the tree reads the folder and its .gitignore. Those reads used
        // to be reported as changes, which triggered another refresh, endlessly.
        let root = temp_project("reads");
        std::fs::write(root.join(".gitignore"), "node_modules\n").unwrap();

        let (tx, rx) = mpsc::channel();
        let mut debouncer = new_debouncer(Duration::from_millis(100), None, move |result: DebounceEventResult| {
            let _ = tx.send(result);
        })
        .unwrap();
        debouncer.watch(&root, RecursiveMode::NonRecursive).unwrap();

        for _ in 0..5 {
            let _ = std::fs::read_to_string(root.join(".gitignore"));
            let _ = std::fs::read_dir(&root).map(|d| d.count());
        }

        let mut changes = 0;
        while let Ok(result) = rx.recv_timeout(Duration::from_millis(600)) {
            if let Ok(events) = result {
                changes += events.iter().filter(|e| !matches!(e.kind, EventKind::Access(_) | EventKind::Other)).count();
            }
        }
        assert_eq!(changes, 0);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn processing_batches_does_not_feed_back_into_the_watcher() {
        // Regression: the handler read the .gitignore on every batch, which raised access events,
        // which produced another batch, and so on without end (seen with `nano .gitignore`).
        let root = temp_project("feedback");
        std::fs::write(root.join(".gitignore"), "node_modules\n").unwrap();

        let (tx, rx) = mpsc::channel();
        let mut debouncer = new_debouncer(Duration::from_millis(100), None, move |result: DebounceEventResult| {
            let _ = tx.send(result);
        })
        .unwrap();
        debouncer.watch(&root, RecursiveMode::NonRecursive).unwrap();

        // One real change to start things off.
        std::fs::write(root.join("index.chord"), "hola").unwrap();

        let mut batches = 0;
        let mut real_changes = 0;
        let deadline = std::time::Instant::now() + Duration::from_secs(4);
        while std::time::Instant::now() < deadline {
            let Ok(result) = rx.recv_timeout(Duration::from_millis(1500)) else { break };
            batches += 1;
            if let Ok(events) = result {
                real_changes += relevant_changes(&root, &events).len();
            }
        }

        assert!(real_changes >= 1, "the real change should be reported");
        assert!(batches <= 3, "watcher kept firing on its own: {} batches", batches);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn always_ignored_paths() {
        assert!(is_always_ignored(Path::new("/p/node_modules/x/y.js")));
        assert!(is_always_ignored(Path::new("/p/.git/HEAD")));
        assert!(!is_always_ignored(Path::new("/p/src/index.chord")));
    }
}
