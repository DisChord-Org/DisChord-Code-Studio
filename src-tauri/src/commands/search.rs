use std::fs;
use std::path::Path;

use ignore::gitignore::Gitignore;
use regex::{NoExpand, Regex, RegexBuilder};
use serde::Serialize;

use crate::paths::project_path;
use super::file::build_gitignore_matcher;

const SKIPPED_DIRS: [&str; 2] = [".git", "node_modules"];
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_FILES_LISTED: usize = 20_000;
const MAX_MATCHES: usize = 1_000;
const MAX_PREVIEW_CHARS: usize = 240;

#[derive(Serialize, Debug, PartialEq)]
pub struct SearchMatch {
    line: usize,
    column: usize,
    length: usize,
    preview: String,
    preview_offset: usize,
}

#[derive(Serialize, Debug)]
pub struct FileMatches {
    path: String,
    matches: Vec<SearchMatch>,
}

#[derive(Serialize, Debug)]
pub struct SearchResults {
    files: Vec<FileMatches>,
    total_matches: usize,
    truncated: bool,
}

fn walk(dir: &Path, root: &Path, matcher: &Gitignore, out: &mut Vec<(String, std::path::PathBuf)>) {
    if out.len() >= MAX_FILES_LISTED {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if SKIPPED_DIRS.contains(&name.as_str()) {
            continue;
        }
        let is_dir = path.is_dir();
        if matcher.matched(&path, is_dir).is_ignore() {
            continue;
        }
        if is_dir {
            walk(&path, root, matcher, out);
        } else if let Ok(rel) = path.strip_prefix(root) {
            out.push((rel.to_string_lossy().replace('\\', "/"), path));
        }
    }
}

fn project_files(root: &Path) -> Result<Vec<(String, std::path::PathBuf)>, String> {
    let matcher = build_gitignore_matcher(root)?;
    let mut files = Vec::new();
    walk(root, root, &matcher, &mut files);
    Ok(files)
}

fn read_text(path: &Path) -> Option<String> {
    if fs::metadata(path).ok()?.len() > MAX_FILE_BYTES {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    if bytes.iter().take(8192).any(|b| *b == 0) {
        return None;
    }
    String::from_utf8(bytes).ok()
}

fn build_regex(query: &str, case_sensitive: bool, use_regex: bool) -> Result<Regex, String> {
    let pattern = if use_regex { query.to_string() } else { regex::escape(query) };
    RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .multi_line(true)
        .build()
        .map_err(|e| format!("Expresión no válida: {}", e))
}

fn search_text(text: &str, re: &Regex, budget: usize) -> Vec<SearchMatch> {
    let mut found = Vec::new();
    for (index, line) in text.lines().enumerate() {
        for m in re.find_iter(line) {
            if m.as_str().is_empty() {
                continue;
            }
            if found.len() >= budget {
                return found;
            }
            let column = line[..m.start()].chars().count();
            let length = m.as_str().chars().count();
            let offset = column.saturating_sub(30);
            let preview: String = line.chars().skip(offset).take(MAX_PREVIEW_CHARS).collect();
            found.push(SearchMatch {
                line: index + 1,
                column: column + 1,
                length: length.min(MAX_PREVIEW_CHARS),
                preview,
                preview_offset: offset,
            });
        }
    }
    found
}

fn run_search(root: &Path, query: &str, case_sensitive: bool, use_regex: bool) -> Result<SearchResults, String> {
    let mut results = SearchResults { files: Vec::new(), total_matches: 0, truncated: false };
    if query.is_empty() {
        return Ok(results);
    }
    let re = build_regex(query, case_sensitive, use_regex)?;

    for (rel, path) in project_files(root)? {
        let budget = MAX_MATCHES - results.total_matches;
        if budget == 0 {
            results.truncated = true;
            break;
        }
        let Some(text) = read_text(&path) else { continue };
        let matches = search_text(&text, &re, budget);
        if matches.is_empty() {
            continue;
        }
        results.total_matches += matches.len();
        results.files.push(FileMatches { path: rel, matches });
    }
    Ok(results)
}

fn run_replace(root: &Path, query: &str, replacement: &str, case_sensitive: bool, use_regex: bool, only: Option<&str>) -> Result<(usize, usize), String> {
    if query.is_empty() {
        return Ok((0, 0));
    }
    let re = build_regex(query, case_sensitive, use_regex)?;
    let files = match only {
        Some(rel) => {
            if rel.split('/').any(|part| part == "..") {
                return Err("Ruta no válida".into());
            }
            vec![(rel.to_string(), root.join(rel))]
        }
        None => project_files(root)?,
    };

    let (mut changed, mut count) = (0, 0);
    for (_, path) in files {
        let Some(text) = read_text(&path) else { continue };
        let n = re.find_iter(&text).filter(|m| !m.as_str().is_empty()).count();
        if n == 0 {
            continue;
        }
        let new_text = if use_regex {
            re.replace_all(&text, replacement).into_owned()
        } else {
            re.replace_all(&text, NoExpand(replacement)).into_owned()
        };
        fs::write(&path, new_text).map_err(|e| format!("No se pudo escribir {:?}: {}", path, e))?;
        changed += 1;
        count += n;
    }
    Ok((changed, count))
}

#[derive(Serialize)]
pub struct ReplaceSummary {
    files: usize,
    occurrences: usize,
}

#[tauri::command]
pub fn list_project_paths(app_handle: tauri::AppHandle, project_name: String) -> Result<Vec<String>, String> {
    let root = project_path(&app_handle, &project_name);
    Ok(project_files(&root)?.into_iter().map(|(rel, _)| rel).collect())
}

#[tauri::command]
pub fn search_project(app_handle: tauri::AppHandle, project_name: String, query: String, case_sensitive: bool, use_regex: bool) -> Result<SearchResults, String> {
    run_search(&project_path(&app_handle, &project_name), &query, case_sensitive, use_regex)
}

#[tauri::command]
pub fn replace_in_project(app_handle: tauri::AppHandle, project_name: String, query: String, replacement: String, case_sensitive: bool, use_regex: bool, file_path: Option<String>) -> Result<ReplaceSummary, String> {
    let root = project_path(&app_handle, &project_name);
    let (files, occurrences) = run_replace(&root, &query, &replacement, case_sensitive, use_regex, file_path.as_deref())?;
    Ok(ReplaceSummary { files, occurrences })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(label: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("dischord-search-tests-{}-{}", label, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("lib")).unwrap();
        fs::write(root.join(".gitignore"), "lib\n").unwrap();
        fs::write(root.join("src/a.chord"), "Hola mundo\nhola otra vez\n").unwrap();
        fs::write(root.join("lib/b.chord"), "hola ignorado\n").unwrap();
        fs::write(root.join("src/bin.dat"), [0u8, 1, 2, b'h', b'o', b'l', b'a']).unwrap();
        root
    }

    #[test]
    fn search_respects_gitignore_binaries_and_case() {
        let root = scratch("a");
        let r = run_search(&root, "hola", false, false).unwrap();
        assert_eq!(r.total_matches, 2);
        assert_eq!(r.files.len(), 1);
        assert_eq!(r.files[0].path, "src/a.chord");
        let r = run_search(&root, "hola", true, false).unwrap();
        assert_eq!(r.total_matches, 1);
        assert_eq!(r.files[0].matches[0].line, 2);
        assert!(run_search(&root, "(", false, true).is_err());
    }

    #[test]
    fn replace_literal_and_regex() {
        let root = scratch("b");
        assert_eq!(run_replace(&root, "hola", "$1", false, false, None).unwrap(), (1, 2));
        assert_eq!(fs::read_to_string(root.join("src/a.chord")).unwrap(), "$1 mundo\n$1 otra vez\n");
        assert_eq!(run_replace(&root, r"(\w+) mundo", "$1!", true, true, Some("src/a.chord")).unwrap(), (1, 1));
        assert!(run_replace(&root, "x", "y", true, false, Some("../x")).is_err());
    }

    #[test]
    fn listing_skips_ignored() {
        let root = scratch("c");
        let names: Vec<_> = project_files(&root).unwrap().into_iter().map(|f| f.0).collect();
        assert!(names.contains(&"src/a.chord".to_string()));
        assert!(!names.iter().any(|n| n.starts_with("lib/")));
    }
}
