use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::thread;

use log::{error, info};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{Emitter, Manager};

use crate::commands::config_sections::section_values;
use crate::paths::project_path;
use crate::platform::{build_path_env, NPM_ENV_VARS_TO_STRIP};

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct TerminalState(Mutex<HashMap<String, TerminalSession>>);

static NEXT_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Serialize, Clone)]
struct PtyData {
    id: String,
    data: String,
}

#[derive(Serialize, Clone)]
struct PtyExit {
    id: String,
}

fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

// Prompt layout (text colors only, no background blocks: those look heavy in a monospace grid):
//   ╭─ user › ~WorkFlows~ › project
//   ╰─>
// The path is shown in full (nothing is shortened), with the home directory as `~` and the
// projects folder (DISCHORD_WORKFLOWS) collapsed into `~WorkFlows~`. The root label is purple,
// folders are cyan and the current folder is bold white: the same One Dark palette the
// editor uses (see languages/chord-theme.ts), with the UI accent for the user name.

const BASH_RC: &str = r##"[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"
_dischord_update() {
  local p="$PWD" root="${DISCHORD_WORKFLOWS%/}" label rest
  if [ -n "$root" ] && { [ "$p" = "$root" ] || [ "${p#"$root"/}" != "$p" ]; }; then label="~WorkFlows~"; rest="${p#"$root"}"
  elif [ "$p" = "$HOME" ] || [ "${p#"$HOME"/}" != "$p" ]; then label="~"; rest="${p#"$HOME"}"
  else label="/"; rest="$p"; fi
  rest="${rest#/}"
  local c_root=$'\001\e[38;2;198;120;221m\002' c_seg=$'\001\e[38;2;86;182;194m\002' c_last=$'\001\e[1;38;2;255;255;255m\002' c_dim=$'\001\e[38;2;92;99;112m\002' c_rst=$'\001\e[0m\002'
  local sep=" ${c_dim}›${c_rst} " out="${c_root}${label}${c_rst}"
  if [ -n "$rest" ]; then
    local IFS=/ parts n i
    read -ra parts <<< "$rest"
    n=${#parts[@]}
    for ((i = 0; i < n; i++)); do
      if [ "$i" -gt 0 ] || [ "$label" != "/" ]; then out+="$sep"; else out+=" "; fi
      if [ "$i" -eq $((n - 1)) ]; then out+="${c_last}${parts[i]}${c_rst}"; else out+="${c_seg}${parts[i]}${c_rst}"; fi
    done
  fi
  _dischord_path=" ${c_dim}›${c_rst} ${out}"
}
_dischord_ps1() {
  _dischord_update
  PS1='\[\e[38;2;92;99;112m\]╭─\[\e[0m\] \[\e[1;38;2;137;146;245m\]\u\[\e[0m\]${_dischord_path}\n\[\e[38;2;92;99;112m\]╰─\[\e[38;2;137;146;245m\]>\[\e[0m\] '
}
PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND;}_dischord_ps1"
"##;

const ZSH_RC: &str = r##"export ZDOTDIR="${DISCHORD_ORIG_ZDOTDIR:-$HOME}"
[ -f "$ZDOTDIR/.zshrc" ] && source "$ZDOTDIR/.zshrc"
setopt PROMPT_SUBST
_dc_dim=$'%{\e[38;2;92;99;112m%}'; _dc_root=$'%{\e[38;2;198;120;221m%}'; _dc_seg=$'%{\e[38;2;86;182;194m%}'
_dc_last=$'%{\e[1;38;2;255;255;255m%}'; _dc_user=$'%{\e[1;38;2;137;146;245m%}'; _dc_arrow=$'%{\e[38;2;137;146;245m%}'; _dc_rst=$'%{\e[0m%}'
_dischord_update() {
  local p="$PWD" root="${DISCHORD_WORKFLOWS%/}" label rest
  if [[ -n "$root" && ( "$p" == "$root" || "$p" == "$root"/* ) ]]; then label="~WorkFlows~"; rest="${p#$root}"
  elif [[ "$p" == "$HOME" || "$p" == "$HOME"/* ]]; then label="~"; rest="${p#$HOME}"
  else label="/"; rest="$p"; fi
  rest="${rest#/}"
  local sep=" ${_dc_dim}›${_dc_rst} "
  local out="${_dc_root}${label}${_dc_rst}"
  if [[ -n "$rest" ]]; then
    local -a parts; parts=("${(@s:/:)rest}")
    local n=${#parts} i seg
    for (( i = 1; i <= n; i++ )); do
      seg="${parts[i]//\%/%%}"
      if (( i > 1 )) || [[ "$label" != "/" ]]; then out+="$sep"; else out+=" "; fi
      if (( i == n )); then out+="${_dc_last}${seg}${_dc_rst}"; else out+="${_dc_seg}${seg}${_dc_rst}"; fi
    done
  fi
  _dischord_path=" ${_dc_dim}›${_dc_rst} ${out}"
}
_dischord_prompt() {
  _dischord_update
  PROMPT=$'${_dc_dim}╭─${_dc_rst} ${_dc_user}%n${_dc_rst}${_dischord_path}\n${_dc_dim}╰─${_dc_arrow}>${_dc_rst} '
  RPROMPT=''
}
precmd_functions+=(_dischord_prompt)
"##;

const POWERSHELL_PROMPT: &str = r##"function prompt { $e = [char]27; $s = [IO.Path]::DirectorySeparatorChar; $p = (Get-Location).Path; $r = $env:DISCHORD_WORKFLOWS; $h = $HOME; if ($r -and ($p -eq $r -or $p.StartsWith($r + $s))) { $label = '~WorkFlows~'; $rest = $p.Substring($r.Length) } elseif ($p -eq $h -or $p.StartsWith($h + $s)) { $label = '~'; $rest = $p.Substring($h.Length) } else { $label = '/'; $rest = $p; if ($p -match '^[A-Za-z]:') { $label = $p.Substring(0, 2); $rest = $p.Substring(2) } }; $parts = @($rest -split '[\\/]' | Where-Object { $_ }); $sep = ' ' + $e + '[38;2;92;99;112m›' + $e + '[0m '; $out = $e + '[38;2;198;120;221m' + $label + $e + '[0m'; for ($i = 0; $i -lt $parts.Count; $i++) { if ($i -gt 0 -or $label -ne '/') { $out += $sep } else { $out += ' ' }; if ($i -eq $parts.Count - 1) { $out += $e + '[1;38;2;255;255;255m' + $parts[$i] + $e + '[0m' } else { $out += $e + '[38;2;86;182;194m' + $parts[$i] + $e + '[0m' } }; $e + '[38;2;92;99;112m╭─' + $e + '[0m ' + $e + '[1;38;2;137;146;245m' + [Environment]::UserName + $e + '[0m' + $sep + $out + [Environment]::NewLine + $e + '[38;2;92;99;112m╰─' + $e + '[38;2;137;146;245m>' + $e + '[0m ' }"##;

/// Makes the shell show the IDE's own prompt instead of whatever the user has configured
/// (oh-my-posh, powerlevel10k...), which would otherwise look different on every machine.
/// The user's own rc files are still loaded first, and the prompt is re-applied on every
/// prompt redraw so frameworks that rewrite it each time don't win.
fn apply_prompt_style(app_handle: &tauri::AppHandle, cmd: &mut CommandBuilder, shell: &str, workflows_dir: &Path) {
    cmd.env("DISCHORD_WORKFLOWS", workflows_dir);

    let Ok(dir) = app_handle.path().app_config_dir().map(|d| d.join("terminal")) else { return };
    let name = Path::new(shell).file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();

    match name.as_str() {
        "bash" => {
            let rc = dir.join("bashrc");
            if fs::create_dir_all(&dir).and_then(|_| fs::write(&rc, BASH_RC)).is_ok() {
                cmd.arg("--rcfile");
                cmd.arg(rc);
            }
        }
        "zsh" => {
            let zdotdir = dir.join("zsh");
            if fs::create_dir_all(&zdotdir).and_then(|_| fs::write(zdotdir.join(".zshrc"), ZSH_RC)).is_ok() {
                if let Ok(original) = std::env::var("ZDOTDIR") {
                    cmd.env("DISCHORD_ORIG_ZDOTDIR", original);
                }
                cmd.env("ZDOTDIR", zdotdir);
            }
        }
        "powershell" | "pwsh" => {
            cmd.args(["-NoLogo", "-NoExit", "-Command", POWERSHELL_PROMPT]);
        }
        "sh" | "dash" => {
            cmd.env("PS1", "╰─> ");
        }
        _ => {}
    }
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize { rows: rows.max(1), cols: cols.max(1), pixel_width: 0, pixel_height: 0 }
}

/// Emits every complete UTF-8 sequence in `pending`, keeping a trailing partial one for the
/// next read so multi-byte characters split across reads aren't corrupted.
fn drain_utf8(pending: &mut Vec<u8>) -> Option<String> {
    if pending.is_empty() {
        return None;
    }
    let valid_up_to = match std::str::from_utf8(pending) {
        Ok(_) => pending.len(),
        Err(e) => match e.error_len() {
            Some(_) => pending.len(),
            None => e.valid_up_to(),
        },
    };
    if valid_up_to == 0 {
        return None;
    }
    let chunk: Vec<u8> = pending.drain(..valid_up_to).collect();
    Some(String::from_utf8_lossy(&chunk).into_owned())
}

#[tauri::command]
pub fn terminal_open(app_handle: tauri::AppHandle, project_name: String, cols: u16, rows: u16) -> Result<String, String> {
    let cwd = project_path(&app_handle, &project_name);

    let pair = native_pty_system().openpty(pty_size(cols, rows)).map_err(|e| e.to_string())?;

    let shell = default_shell();
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);
    for var in NPM_ENV_VARS_TO_STRIP {
        cmd.env_remove(var);
    }
    if let Some(path) = build_path_env(&app_handle) {
        cmd.env("PATH", path);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let use_dischord_prompt = section_values(&app_handle, "terminal").get("prompt").and_then(|v| v.as_str()) == Some("dischord");
    if use_dischord_prompt {
        let workflows_dir = cwd.parent().map(Path::to_path_buf).unwrap_or_else(|| cwd.clone());
        apply_prompt_style(&app_handle, &mut cmd, &shell, &workflows_dir);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst).to_string();

    app_handle
        .state::<TerminalState>()
        .0
        .lock()
        .unwrap()
        .insert(id.clone(), TerminalSession { master: pair.master, writer, child });

    info!("Terminal interactiva {} abierta en {:?}", id, cwd);

    let reader_handle = app_handle.clone();
    let reader_id = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut pending: Vec<u8> = Vec::new();

        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    if let Some(data) = drain_utf8(&mut pending) {
                        let _ = reader_handle.emit("pty-data", PtyData { id: reader_id.clone(), data });
                    }
                }
            }
        }

        if let Some(mut session) = reader_handle.state::<TerminalState>().0.lock().unwrap().remove(&reader_id) {
            let _ = session.child.kill();
        }
        let _ = reader_handle.emit("pty-exit", PtyExit { id: reader_id });
    });

    Ok(id)
}

#[tauri::command]
pub fn terminal_write(state: tauri::State<'_, TerminalState>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.0.lock().unwrap();
    let session = sessions.get_mut(&id).ok_or("La terminal ya no existe")?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_resize(state: tauri::State<'_, TerminalState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&id).ok_or("La terminal ya no existe")?;
    session.master.resize(pty_size(cols, rows)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_close(state: tauri::State<'_, TerminalState>, id: String) {
    if let Some(mut session) = state.0.lock().unwrap().remove(&id) {
        if let Err(e) = session.child.kill() {
            error!("No se pudo cerrar la terminal {}: {}", id, e);
        }
        info!("Terminal interactiva {} cerrada", id);
    }
}

pub fn close_all(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<TerminalState>();
    let mut sessions = state.0.lock().unwrap();
    for (_, mut session) in sessions.drain() {
        let _ = session.child.kill();
    }
}
