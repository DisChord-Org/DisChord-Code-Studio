use std::fs;
use std::path::Path;

use ignore::gitignore::{Gitignore, GitignoreBuilder};

use crate::log_err::LogErr;

pub(super) const GITIGNORE_FILE: &str = ".gitignore";

fn anchor_to_root(line: &str) -> String {
    let trimmed = line.trim_end();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return line.to_string();
    }

    let (negation, pattern) = match trimmed.strip_prefix('!') {
        Some(rest) => ("!", rest),
        None => ("", trimmed),
    };

    let body = pattern.strip_suffix('/').unwrap_or(pattern);
    if body.is_empty() || body.contains('/') {
        return line.to_string();
    }

    format!("{}/{}", negation, pattern)
}


pub(crate) fn build_gitignore_matcher(root_path: &Path) -> Result<Gitignore, String> {
    let mut builder = GitignoreBuilder::new(root_path);

    if let Ok(contents) = fs::read_to_string(root_path.join(GITIGNORE_FILE)) {
        for line in contents.lines() {
            let _ = builder.add_line(None, &anchor_to_root(line));
        }
    }

    builder.build().log_err("Error al construir el matcher de gitignore")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_project(label: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("dischord-file-tests-{}-{}", label, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("src/commands")).unwrap();
        fs::write(root.join("src/index.chord"), "x").unwrap();
        fs::write(root.join("src/commands/ping.chord"), "y").unwrap();
        fs::create_dir_all(root.join("lib")).unwrap();
        root
    }

    fn ignored(root: &Path, relative: &str, is_dir: bool) -> bool {
        let matcher = build_gitignore_matcher(root).unwrap();
        matcher.matched(root.join(relative), is_dir).is_ignore()
    }

    #[test]
    fn a_plain_name_is_pinned_to_the_root() {
        assert_eq!(anchor_to_root("lib"), "/lib");
        assert_eq!(anchor_to_root("*.log"), "/*.log");
        assert_eq!(anchor_to_root("dist/"), "/dist/");
        assert_eq!(anchor_to_root("!keep.log"), "!/keep.log");
    }

    #[test]
    fn lines_with_a_path_or_no_pattern_are_left_alone() {
        assert_eq!(anchor_to_root("src/gen"), "src/gen");
        assert_eq!(anchor_to_root("/build"), "/build");
        assert_eq!(anchor_to_root("**/cache"), "**/cache");
        assert_eq!(anchor_to_root("# comentario"), "# comentario");
        assert_eq!(anchor_to_root(""), "");
    }

    #[test]
    fn only_the_root_and_the_given_paths_are_hidden() {
        let root = scratch_project("gitignore");
        fs::write(root.join(".gitignore"), "lib\n*.log\nsrc/commands/gen/\n").unwrap();

        assert!(ignored(&root, "lib", true));
        assert!(ignored(&root, "debug.log", false));
        assert!(ignored(&root, "src/commands/gen", true));

        assert!(!ignored(&root, "src/lib", true));
        assert!(!ignored(&root, "src/debug.log", false));
        assert!(!ignored(&root, "other/src/commands/gen", true));
    }
}
