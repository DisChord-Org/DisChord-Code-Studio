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
