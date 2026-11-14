use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use ignore::overrides::OverrideBuilder;
use regex::RegexBuilder;
use serde_json::Value;

use crate::commands::search::project_files;
use crate::proc::wait_with_timeout;
use crate::platform::{default_shell, isolate_process_group, silent_command, strip_npm_env, terminate_process_tree};

const MAX_OUTPUT_CHARS: usize = 12_000;
const DEFAULT_READ_LINES: usize = 300;
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_LISTED: usize = 500;
const DEFAULT_MATCHES: usize = 200;
const MAX_LINE_CHARS: usize = 240;
const SHELL_TIMEOUT: Duration = Duration::from_secs(300);
const POLL_INTERVAL: Duration = Duration::from_millis(25);
const REGEX_SIZE_LIMIT: usize = 1 << 20;

pub struct Outcome {
    pub ok: bool,
    pub output: String,
    pub exit_code: Option<i32>,
}

impl Outcome {
    fn ok(output: impl Into<String>) -> Self {
        Outcome { ok: true, output: output.into(), exit_code: None }
    }

    pub fn error(output: impl Into<String>) -> Self {
        Outcome { ok: false, output: output.into(), exit_code: None }
    }
}

type Step<T> = Result<T, String>;

fn clip(text: String) -> String {
    let total = text.chars().count();
    if total <= MAX_OUTPUT_CHARS {
        return text;
    }
    let half = MAX_OUTPUT_CHARS / 2;
    let head: String = text.chars().take(half).collect();
    let tail: String = text.chars().skip(total - half).collect();
    format!("{}\n[… {} caracteres omitidos …]\n{}", head, total - MAX_OUTPUT_CHARS, tail)
}

fn is_secret_file(path: &Path) -> bool {
    let name = path.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
    if name.starts_with(".env") {
        return !matches!(name.as_str(), ".env.example" | ".env.sample" | ".env.template");
    }
    const EXACT: [&str; 7] = [".npmrc", ".netrc", ".pypirc", "token", "tokens", "credentials", "ai_session.json"];
    const PREFIXES: [&str; 4] = ["id_rsa", "id_ed25519", "credentials.", "credentials_"];
    const STEM_PREFIXES: [&str; 3] = ["secrets.", "secret.", "tokens."];
    const SUFFIXES: [&str; 5] = [".pem", ".key", ".p12", ".pfx", ".token"];
    EXACT.contains(&name.as_str())
        || PREFIXES.iter().any(|p| name.starts_with(p))
        || STEM_PREFIXES.iter().any(|p| name.starts_with(p))
        || SUFFIXES.iter().any(|s| name.ends_with(s))
}

fn confine(root: &Path, requested: &str) -> Step<PathBuf> {
    let root = root.canonicalize().map_err(|e| format!("No se pudo abrir el proyecto: {}", e))?;
    let raw = Path::new(requested);
    let full = if raw.is_absolute() { raw.to_path_buf() } else { root.join(raw) };

    let invalid = full.components().any(|c| matches!(c, Component::ParentDir));
    let existing = full.ancestors().find(|p| p.exists());
    let inside = existing.and_then(|p| p.canonicalize().ok()).is_some_and(|p| p.starts_with(&root));
    if invalid || !inside {
        return Err(format!("La ruta '{}' queda fuera del proyecto.", requested));
    }
    if full.components().any(|c| c.as_os_str().to_string_lossy().eq_ignore_ascii_case(".git")) {
        return Err("No se permite acceder a la carpeta .git.".into());
    }
    if is_secret_file(&full) && !full.is_dir() {
        return Err("No se permite acceder a archivos de secretos (.env, claves, tokens, credenciales): pueden contener secretos.".into());
    }
    Ok(full)
}

fn read_text(path: &Path) -> Step<String> {
    let meta = fs::metadata(path).map_err(|e| format!("No se pudo leer '{}': {}", path.display(), e))?;
    if !meta.is_file() {
        return Err(format!("'{}' no es un archivo.", path.display()));
    }
    if meta.len() > MAX_FILE_BYTES {
        return Err("El archivo es demasiado grande.".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.iter().take(8192).any(|b| *b == 0) {
        return Err("El archivo es binario.".into());
    }
    String::from_utf8(bytes).map_err(|_| "El archivo no es UTF-8.".to_string())
}

fn text_arg<'a>(args: &'a Value, key: &str) -> Step<&'a str> {
    args.get(key).and_then(Value::as_str).ok_or_else(|| format!("Falta el argumento '{}'.", key))
}

fn count_arg(args: &Value, keys: &[&str], default: usize) -> usize {
    keys.iter().find_map(|k| args.get(*k).and_then(Value::as_u64)).map(|n| n as usize).unwrap_or(default).max(1)
}

fn shorten_line(line: &str) -> String {
    if line.chars().count() > MAX_LINE_CHARS {
        format!("{}…", line.chars().take(MAX_LINE_CHARS).collect::<String>())
    } else {
        line.to_string()
    }
}

fn read_file(root: &Path, args: &Value) -> Step<String> {
    let path = confine(root, text_arg(args, "path")?)?;
    let text = read_text(&path)?;
    let lines: Vec<&str> = text.lines().collect();

    let offset = count_arg(args, &["offset"], 1);
    let limit = count_arg(args, &["limit"], DEFAULT_READ_LINES);
    let end = (offset - 1 + limit).min(lines.len());
    if offset > lines.len().max(1) {
        return Err(format!("El archivo solo tiene {} líneas.", lines.len()));
    }

    let mut out: String = lines[offset - 1..end].iter().enumerate().map(|(i, l)| format!("{}\t{}\n", offset + i, l)).collect();
    if end < lines.len() {
        out.push_str(&format!("[… quedan {} líneas; pide más con offset {}]", lines.len() - end, end + 1));
    }
    Ok(out)
}

fn list_directory(root: &Path, args: &Value) -> Step<String> {
    let path = confine(root, text_arg(args, "path")?)?;
    let mut entries: Vec<String> = fs::read_dir(&path)
        .map_err(|e| format!("No se pudo listar '{}': {}", path.display(), e))?
        .flatten()
        .map(|e| format!("{}{}", e.file_name().to_string_lossy(), if e.file_type().is_ok_and(|t| t.is_dir()) { "/" } else { "" }))
        .collect();
    entries.sort();
    let extra = entries.len().saturating_sub(MAX_LISTED);
    entries.truncate(MAX_LISTED);
    if extra > 0 {
        entries.push(format!("[… {} entradas más]", extra));
    }
    Ok(entries.join("\n"))
}

fn write_file(root: &Path, args: &Value) -> Step<String> {
    let path = confine(root, text_arg(args, "path")?)?;
    let content = text_arg(args, "content")?;
    if content.len() as u64 > MAX_FILE_BYTES {
        return Err("El contenido es demasiado grande.".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| format!("No se pudo escribir '{}': {}", path.display(), e))?;
    Ok(format!("Escrito {} ({} bytes).", path.display(), content.len()))
}

fn edit_file(root: &Path, args: &Value) -> Step<String> {
    let path = confine(root, text_arg(args, "path")?)?;
    let old = text_arg(args, "old_string")?;
    let new = text_arg(args, "new_string")?;
    let all = args.get("replace_all").and_then(Value::as_bool).unwrap_or(false);
    if old.is_empty() {
        return Err("old_string no puede estar vacío.".into());
    }

    let text = read_text(&path)?;
    let found = text.matches(old).count();
    if found == 0 {
        return Err("No se encontró old_string en el archivo.".into());
    }
    if found > 1 && !all {
        return Err(format!("old_string aparece {} veces; añade contexto o usa replace_all.", found));
    }

    let updated = if all { text.replace(old, new) } else { text.replacen(old, new, 1) };
    fs::write(&path, updated).map_err(|e| format!("No se pudo escribir '{}': {}", path.display(), e))?;
    Ok(format!("Editado {} ({} cambio{}).", path.display(), if all { found } else { 1 }, if all && found != 1 { "s" } else { "" }))
}

fn glob_filter(root: &Path, pattern: &str) -> Step<ignore::overrides::Override> {
    let mut builder = OverrideBuilder::new(root);
    builder.add(pattern).map_err(|e| format!("Patrón no válido: {}", e))?;
    builder.build().map_err(|e| format!("Patrón no válido: {}", e))
}

fn search_files(root: &Path, args: &Value) -> Step<String> {
    let pattern = text_arg(args, "pattern")?;
    let insensitive = args.get("case_insensitive").and_then(Value::as_bool).unwrap_or(false);
    let limit = count_arg(args, &["max_results", "limit", "head_limit", "max_matches"], DEFAULT_MATCHES);
    let re = RegexBuilder::new(pattern).case_insensitive(insensitive).size_limit(REGEX_SIZE_LIMIT).build().map_err(|e| format!("Expresión no válida: {}", e))?;
    let filter = args.get("glob").and_then(Value::as_str).map(|g| glob_filter(root, g)).transpose()?;

    let mut out = Vec::new();
    'files: for (rel, full) in project_files(root)? {
        if is_secret_file(&full) || filter.as_ref().is_some_and(|f| !f.matched(&rel, false).is_whitelist()) {
            continue;
        }
        let Ok(text) = read_text(&full) else { continue };
        for (number, line) in text.lines().enumerate() {
            if re.is_match(line) {
                out.push(format!("{}:{}:{}", rel, number + 1, shorten_line(line.trim())));
                if out.len() >= limit {
                    out.push("[… hay más resultados; afina la búsqueda]".into());
                    break 'files;
                }
            }
        }
    }
    Ok(if out.is_empty() { "Sin resultados.".into() } else { out.join("\n") })
}

fn find_files(root: &Path, args: &Value) -> Step<String> {
    let filter = glob_filter(root, text_arg(args, "pattern")?)?;
    let limit = count_arg(args, &["max_results", "limit", "head_limit"], DEFAULT_MATCHES);

    let mut found: Vec<String> = project_files(root)?
        .into_iter()
        .filter(|(rel, full)| !is_secret_file(full) && filter.matched(rel, false).is_whitelist())
        .map(|(rel, _)| rel)
        .collect();
    let extra = found.len().saturating_sub(limit);
    found.truncate(limit);
    if extra > 0 {
        found.push(format!("[… {} archivos más]", extra));
    }
    Ok(if found.is_empty() { "Sin resultados.".into() } else { found.join("\n") })
}

fn run_shell(root: &Path, command: &str, cwd: &str, path_env: Option<std::ffi::OsString>) -> Outcome {
    let dir = match confine(root, cwd) {
        Ok(dir) if dir.is_dir() => dir,
        Ok(_) => return Outcome::error(format!("'{}' no es una carpeta.", cwd)),
        Err(message) => return Outcome::error(message),
    };

    let mut process = silent_command(default_shell());
    #[cfg(target_os = "windows")]
    process.args(["-NoProfile", "-Command", command]);
    #[cfg(not(target_os = "windows"))]
    process.arg("-c").arg(command);
    process.current_dir(&dir).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    strip_npm_env(&mut process);
    isolate_process_group(&mut process);
    if let Some(path) = path_env {
        process.env("PATH", path);
    }

    let child = match process.spawn() {
        Ok(child) => child,
        Err(e) => return Outcome::error(format!("No se pudo ejecutar el comando: {}", e)),
    };
    let captured = match wait_with_timeout(child, None, SHELL_TIMEOUT, POLL_INTERVAL, terminate_process_tree) {
        Ok(captured) => captured,
        Err(message) => return Outcome::error(message),
    };
    let (status, timed_out, stdout, stderr) = (captured.code, captured.timed_out, captured.stdout, captured.stderr);
    let mut text = stdout;
    if !stderr.trim().is_empty() {
        text.push_str(&format!("{}[stderr]\n{}", if text.is_empty() { "" } else { "\n" }, stderr));
    }
    if timed_out {
        text.push_str(&format!("\n[El comando superó el límite de {} s y se detuvo.]", SHELL_TIMEOUT.as_secs()));
    }
    Outcome { ok: !timed_out && status == Some(0), output: clip(text), exit_code: status }
}

pub fn run(root: &Path, tool: &str, args: &Value, command: &str, cwd: &str, path_env: Option<std::ffi::OsString>) -> Outcome {
    let result = match tool {
        "run_command" => return run_shell(root, command, cwd, path_env),
        "read_file" => read_file(root, args),
        "list_directory" => list_directory(root, args),
        "write_file" => write_file(root, args),
        "edit_file" => edit_file(root, args),
        "search_files" => search_files(root, args),
        "find_files" => find_files(root, args),
        "add_mcp_server" => Err("Añadir servidores MCP no está disponible en el IDE.".into()),
        other => Err(format!("Herramienta desconocida: {}.", other)),
    };
    match result {
        Ok(output) => Outcome::ok(clip(output)),
        Err(message) => Outcome::error(message),
    }
}

const SHELL_SYNTAX: &str = ";&|<>$`(){}\\\"'*?~!#\n\r";
const MAX_MINOR_COMMAND_CHARS: usize = 200;
const VERSION_PROGRAMS: [&str; 7] = ["node", "npm", "pnpm", "git", "chord", "dischord", "dischord-compiler"];
const GIT_READ_ONLY: [&str; 4] = ["status", "log", "branch", "rev-parse"];
const GIT_RISKY_FLAGS: [&str; 6] = ["-p", "--patch", "--output", "--ext-diff", "--textconv", "-c"];

fn is_plain_word(word: &str) -> bool {
    !word.is_empty() && word.chars().all(|c| c.is_ascii_alphanumeric() || "._/@^:=-".contains(c))
}

fn is_local_path(word: &str) -> bool {
    is_plain_word(word) && !word.contains(':') && !word.starts_with('/') && !word.split('/').any(|part| part == "..")
}

const GIT_BRANCH_LIST_FLAGS: [&str; 6] = ["--list", "-a", "-v", "-vv", "-r", "--all"];

pub fn is_minor_command(command: &str) -> bool {
    let command = command.trim();
    if command.is_empty() || command.chars().count() > MAX_MINOR_COMMAND_CHARS || command.chars().any(|c| SHELL_SYNTAX.contains(c)) {
        return false;
    }

    let words: Vec<&str> = command.split_whitespace().collect();
    let (program, args) = (words[0], &words[1..]);

    match program {
        "pwd" => args.is_empty(),
        "ls" => args.iter().all(|a| a.starts_with('-') && is_plain_word(a) || is_local_path(a)),
        "git" if args.first() == Some(&"branch") => args[1..].iter().all(|a| GIT_BRANCH_LIST_FLAGS.contains(a)),
        "git" if args.first().is_some_and(|sub| GIT_READ_ONLY.contains(sub)) => {
            args[1..].iter().all(|a| is_local_path(a) && !GIT_RISKY_FLAGS.iter().any(|risky| a == risky || a.starts_with(&format!("{}=", risky))))
        }
        _ => VERSION_PROGRAMS.contains(&program) && matches!(args, ["--version"] | ["-v"] | ["-V"]),
    }
}

#[cfg(test)]
mod tests;
