use std::path::PathBuf;

use futures_util::{SinkExt, StreamExt};
use log::{info, warn};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::{protocol::Message, Error as WsError};

use super::auth::{self, StoredSession};
use super::tools;
use super::{emit, AiState, PendingCommand};
use crate::platform::build_path_env;

const UNAUTHORIZED_CLOSE: u16 = 4001;
const PREVIEW_CHARS: usize = 600;
const MAX_DIFF_LINES: usize = 40;
const MAX_DIFF_LINE_CHARS: usize = 200;

enum ConnectError {
    Unauthorized,
    Other(String),
}

fn preview(text: &str) -> String {
    if text.chars().count() > PREVIEW_CHARS {
        format!("{}…", text.chars().take(PREVIEW_CHARS).collect::<String>())
    } else {
        text.to_string()
    }
}

async fn open(app: &AppHandle, token: &str) -> Result<mpsc::UnboundedSender<String>, ConnectError> {
    let url = format!("{}?token={}&client={}", auth::WS_URL, token, auth::client_version(app));
    let (stream, _) = tokio_tungstenite::connect_async(url).await.map_err(|e| match e {
        WsError::Http(response) if matches!(response.status().as_u16(), 401 | 403) => ConnectError::Unauthorized,
        WsError::Http(response) => ConnectError::Other(format!("El servidor rechazó la conexión ({}).", response.status())),
        _ => ConnectError::Other("No se pudo conectar con el servidor del asistente.".into()),
    })?;

    let (mut write, mut read) = stream.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    tauri::async_runtime::spawn(async move {
        while let Some(text) = rx.recv().await {
            if write.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
        let _ = write.close().await;
    });

    let reader_app = app.clone();
    let reader_tx = tx.clone();
    tauri::async_runtime::spawn(async move {
        let mut close_code: Option<u16> = None;
        while let Some(frame) = read.next().await {
            match frame {
                Ok(Message::Text(text)) => on_text(&reader_app, text.as_str()),
                Ok(Message::Close(frame)) => {
                    close_code = frame.map(|f| u16::from(f.code));
                    break;
                }
                Ok(_) => {}
                Err(_) => break,
            }
        }
        on_closed(&reader_app, &reader_tx, close_code).await;
    });

    Ok(tx)
}

async fn on_closed(app: &AppHandle, tx: &mpsc::UnboundedSender<String>, code: Option<u16>) {
    let state = app.state::<AiState>();
    {
        let mut inner = state.0.lock().await;
        if inner.socket.as_ref().is_some_and(|current| current.same_channel(tx)) {
            inner.socket = None;
        }
    }
    info!("Conexión con el asistente cerrada ({:?})", code);
    emit(app, json!({ "type": "ai:closed", "code": code }));
    if code == Some(UNAUTHORIZED_CLOSE) {
        let _ = renew(app).await;
    }
}

static RENEW_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

pub(super) async fn renew(app: &AppHandle) -> Result<StoredSession, String> {
    let state = app.state::<AiState>();
    let stale_token = state.0.lock().await.session(app).access_token.clone();
    let _guard = RENEW_LOCK.lock().await;
    let current = state.0.lock().await.session(app).clone();
    if current.signed_in() && current.access_token != stale_token {
        return Ok(current);
    }
    match auth::refresh(app, &current).await {
        Ok(next) => {
            auth::save(app, &next)?;
            state.0.lock().await.session = Some(next.clone());
            Ok(next)
        }
        Err(message) => {
            let mut inner = state.0.lock().await;
            let signed_out = current.signed_out();
            let _ = auth::save(app, &signed_out);
            inner.session = Some(signed_out);
            emit(app, json!({ "type": "ai:auth", "status": "expired", "message": message }));
            Err(message)
        }
    }
}

pub async fn ensure_connected(app: &AppHandle, state: &State<'_, AiState>) -> Result<(), String> {
    let token = {
        let mut inner = state.0.lock().await;
        if inner.socket.as_ref().is_some_and(|s| !s.is_closed()) {
            return Ok(());
        }
        inner.session(app).access_token.clone()
    };

    let tx = match open(app, &token).await {
        Ok(tx) => tx,
        Err(ConnectError::Other(message)) => return Err(message),
        Err(ConnectError::Unauthorized) => {
            let renewed = renew(app).await?;
            match open(app, &renewed.access_token).await {
                Ok(tx) => tx,
                Err(ConnectError::Unauthorized) => return Err(super::NOT_SIGNED_IN.into()),
                Err(ConnectError::Other(message)) => return Err(message),
            }
        }
    };
    state.0.lock().await.socket = Some(tx);
    Ok(())
}

fn on_text(app: &AppHandle, text: &str) {
    let Ok(message) = serde_json::from_str::<Value>(text) else { return };
    if message.get("type").and_then(Value::as_str) != Some("command:request") {
        emit(app, message);
        return;
    }

    let command = message.get("command").cloned().unwrap_or(Value::Null);
    let requires_approval = message.get("requiresApproval").and_then(Value::as_bool).unwrap_or(true);
    let app = app.clone();
    tauri::async_runtime::spawn(async move { handle_request(app, command, requires_approval).await });
}

async fn send(app: &AppHandle, message: Value) {
    let inner = app.state::<AiState>();
    let inner = inner.0.lock().await;
    match inner.socket.as_ref() {
        Some(socket) => {
            let _ = socket.send(message.to_string());
        }
        None => warn!("No hay conexión para enviar {}", message.get("type").and_then(Value::as_str).unwrap_or("un mensaje")),
    }
}

async fn send_result(app: &AppHandle, id: &str, ok: bool, output: &str, exit_code: Option<i32>) {
    let mut message = json!({ "type": "command:result", "commandId": id, "status": if ok { "success" } else { "error" }, "output": output });
    if let Some(code) = exit_code {
        message["exitCode"] = json!(code);
    }
    send(app, message).await;
}

struct Call {
    tool: String,
    args: Value,
    command: String,
    cwd: String,
}

fn call_of(command: &Value) -> Call {
    let text = |key: &str| command.get(key).and_then(Value::as_str).unwrap_or_default().to_string();

    if text("kind") == "shell" {
        return Call { tool: "run_command".into(), args: Value::Null, command: text("command"), cwd: text("cwd") };
    }

    let mut args = match command.get("mcpArguments") {
        Some(Value::String(raw)) => serde_json::from_str(raw).unwrap_or(Value::Null),
        Some(other) => other.clone(),
        None => Value::Null,
    };
    let resolved = text("mcpResolvedPath");
    if !resolved.is_empty() && args.get("path").is_some() {
        args["path"] = Value::String(resolved);
    }
    Call { tool: text("mcpTool"), args, command: String::new(), cwd: String::new() }
}

fn summary_of(call: &Call) -> String {
    if call.tool == "run_command" {
        return call.command.clone();
    }
    let target = ["path", "pattern"].iter().find_map(|k| call.args.get(*k).and_then(Value::as_str)).unwrap_or_default();
    format!("{} {}", call.tool, target).trim().to_string()
}

fn diff_lines(removed: &str, added: &str) -> String {
    let marked = |mark: char, text: &str| {
        text.lines().map(|line| format!("{} {}", mark, line.chars().take(MAX_DIFF_LINE_CHARS).collect::<String>())).collect::<Vec<_>>()
    };
    let mut lines = marked('-', removed);
    lines.extend(marked('+', added));
    let extra = lines.len().saturating_sub(MAX_DIFF_LINES);
    lines.truncate(MAX_DIFF_LINES);
    if extra > 0 {
        lines.push(format!("… {} líneas más", extra));
    }
    lines.join("\n")
}

fn detail_of(call: &Call) -> Option<String> {
    let text = |key: &str| call.args.get(key).and_then(Value::as_str);
    match call.tool.as_str() {
        "write_file" => text("content").map(|content| diff_lines("", content)),
        "edit_file" => Some(diff_lines(text("old_string").unwrap_or_default(), text("new_string").unwrap_or_default())),
        "run_command" if !call.cwd.is_empty() => Some(format!("en {}", call.cwd)),
        _ => None,
    }
}

pub fn summary_for(command: &Value) -> String {
    summary_of(&call_of(command))
}

fn runs_without_asking(call: &Call) -> bool {
    match call.tool.as_str() {
        "read_file" | "list_directory" | "search_files" | "find_files" => true,
        "run_command" => tools::is_minor_command(&call.command),
        _ => false,
    }
}

async fn handle_request(app: AppHandle, command: Value, server_asked: bool) {
    let id = command.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
    if id.is_empty() {
        return;
    }

    let root = app.state::<AiState>().0.lock().await.root.clone();
    let Some(root) = root else {
        send_result(&app, &id, false, "No hay ningún proyecto abierto en el IDE.", None).await;
        return;
    };

    let call = call_of(&command);

    if !runs_without_asking(&call) {
        emit(&app, json!({
            "type": "ai:approval",
            "commandId": id,
            "tool": call.tool,
            "summary": summary_of(&call),
            "detail": detail_of(&call),
        }));
        app.state::<AiState>().0.lock().await.pending.insert(id, PendingCommand { command, server_asked, root });
        return;
    }

    if server_asked {
        send(&app, json!({ "type": "command:respond", "commandId": id, "approved": true })).await;
    }
    execute(app, command, root).await;
}

pub async fn execute(app: AppHandle, command: Value, root: PathBuf) {
    let id = command.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
    let call = call_of(&command);
    let summary = summary_of(&call);
    emit(&app, json!({ "type": "ai:command", "commandId": id, "status": "running", "tool": call.tool, "summary": summary }));

    let path_env = build_path_env(&app);
    let outcome = tauri::async_runtime::spawn_blocking(move || tools::run(&root, &call.tool, &call.args, &call.command, &call.cwd, path_env))
        .await
        .unwrap_or_else(|e| tools::Outcome::error(format!("El comando falló: {}", e)));

    send_result(&app, &id, outcome.ok, &outcome.output, outcome.exit_code).await;
    emit(&app, json!({
        "type": "ai:command",
        "commandId": id,
        "status": if outcome.ok { "success" } else { "error" },
        "summary": summary,
        "output": preview(&outcome.output),
    }));
}
