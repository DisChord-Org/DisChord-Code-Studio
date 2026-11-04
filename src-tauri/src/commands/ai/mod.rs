mod auth;
mod socket;
mod tools;

use std::collections::HashMap;
use std::time::Duration;

use log::{info, warn};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::{mpsc, Mutex};

use crate::paths::resolve_in_project;
use auth::{PairingState, StoredSession};

const EVENT: &str = "ai-event";
const MAX_SESSIONS_LISTED: usize = 30;
const POLL_EVERY: Duration = Duration::from_secs(2);
const DISCHORD_SKILL: &str = "dischord";
pub(crate) const NOT_SIGNED_IN: &str = "not_signed_in";

pub(crate) fn emit(app: &AppHandle, event: Value) {
    let _ = app.emit(EVENT, event);
}

pub(crate) struct PendingCommand {
    pub command: Value,
    pub server_asked: bool,
    pub root: std::path::PathBuf,
}

#[derive(Default)]
pub(crate) struct Inner {
    pub(crate) session: Option<StoredSession>,
    pub socket: Option<mpsc::UnboundedSender<String>>,
    pub root: Option<std::path::PathBuf>,
    pub pending: HashMap<String, PendingCommand>,
    has_dischord_skill: Option<bool>,
    avatar: Option<(String, String)>,
    pub(crate) login: u64,
}

#[derive(Default)]
pub struct AiState(pub(crate) Mutex<Inner>);

impl Inner {
    pub(crate) fn session(&mut self, app: &AppHandle) -> &mut StoredSession {
        self.session.get_or_insert_with(|| auth::load(app))
    }
}

fn user_of(session: &StoredSession) -> Value {
    session.user.clone().unwrap_or(Value::Null)
}

#[tauri::command]
pub async fn ai_status(app: AppHandle, state: State<'_, AiState>) -> Result<Value, String> {
    let mut inner = state.0.lock().await;
    let session = inner.session(&app);
    Ok(json!({ "signedIn": session.signed_in(), "user": user_of(session) }))
}

async fn authorized<T, F, Fut>(app: &AppHandle, state: &State<'_, AiState>, call: F) -> Result<T, String>
where
    F: Fn(String) -> Fut,
    Fut: std::future::Future<Output = Result<T, auth::ApiError>>,
{
    let token = {
        let mut inner = state.0.lock().await;
        let session = inner.session(app);
        if !session.signed_in() {
            return Err(NOT_SIGNED_IN.into());
        }
        session.access_token.clone()
    };

    match call(token).await {
        Ok(value) => Ok(value),
        Err(auth::ApiError::Other(message)) => Err(message),
        Err(auth::ApiError::Unauthorized) => {
            let renewed = socket::renew(app).await?;
            call(renewed.access_token).await.map_err(|e| match e {
                auth::ApiError::Unauthorized => NOT_SIGNED_IN.to_string(),
                auth::ApiError::Other(message) => message,
            })
        }
    }
}

#[tauri::command]
pub async fn ai_me(app: AppHandle, state: State<'_, AiState>) -> Result<Value, String> {
    let mut account = authorized(&app, &state, |token| {
        let app = app.clone();
        async move { auth::me(&app, &token).await }
    })
    .await?;

    let avatar_url = account.get("avatarUrl").and_then(Value::as_str).map(str::to_string);
    if avatar_url.is_none() {
        warn!("El servidor no ha enviado la dirección del avatar");
    }
    if let Some(url) = avatar_url {
        let cached = state.0.lock().await.avatar.clone().filter(|(from, _)| *from == url);
        let data = match cached {
            Some((_, data)) => Some(data),
            None => auth::avatar_data_url(&url).await,
        };
        if let Some(data) = data {
            state.0.lock().await.avatar = Some((url, data.clone()));
            account["avatarDataUrl"] = Value::String(data);
        }
    }

    let mut inner = state.0.lock().await;
    let session = inner.session(&app);
    let mut user = session.user.clone().unwrap_or_else(|| json!({}));
    for key in ["id", "discordUsername", "plan"] {
        if let Some(value) = account.get(key) {
            user[key] = value.clone();
        }
    }
    session.user = Some(user);
    let _ = auth::save(&app, session);
    Ok(account)
}

#[tauri::command]
pub async fn ai_sessions(app: AppHandle, state: State<'_, AiState>, project_name: String) -> Result<Vec<Value>, String> {
    let root = resolve_in_project(&app, &project_name, "")?;
    let all = authorized(&app, &state, |token| {
        let app = app.clone();
        async move { auth::get_json(&app, &token, "/sessions").await }
    })
    .await?;

    let same_folder = |path: &str| std::path::Path::new(path.trim_end_matches(['/', '\\'])) == root;
    let updated = |s: &Value| s.get("updatedAt").and_then(Value::as_str).map(str::to_string);
    let mut mine: Vec<&Value> = all
        .as_array()
        .map(|list| list.iter().filter(|s| s.get("workingDirectory").and_then(Value::as_str).is_some_and(same_folder)).collect())
        .unwrap_or_default();
    mine.sort_by_key(|s| std::cmp::Reverse(updated(s)));
    let sessions: Vec<Value> = mine.into_iter().take(MAX_SESSIONS_LISTED).cloned().collect();
    Ok(sessions)
}

#[tauri::command]
pub async fn ai_session(app: AppHandle, state: State<'_, AiState>, session_id: String) -> Result<Value, String> {
    if session_id.is_empty() || !session_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("Conversación no válida.".into());
    }
    authorized(&app, &state, |token| {
        let app = app.clone();
        let path = format!("/sessions/{}", session_id);
        async move { auth::get_json(&app, &token, &path).await }
    })
    .await
}

#[tauri::command]
pub async fn ai_compact(state: State<'_, AiState>, session_id: String) -> Result<(), String> {
    send_raw(&state, json!({ "type": "chat:compact", "sessionId": session_id })).await
}

#[tauri::command]
pub async fn ai_login(app: AppHandle, state: State<'_, AiState>) -> Result<(), String> {
    let (device_key, generation) = {
        let mut inner = state.0.lock().await;
        inner.login += 1;
        (inner.session(&app).device_key.clone(), inner.login)
    };

    let pairing = auth::start_pairing(&app, &device_key).await?;
    app.opener().open_url(&pairing.verification_url, None::<&str>).map_err(|e| format!("No se pudo abrir el navegador: {}", e))?;
    emit(&app, json!({ "type": "ai:auth", "status": "pending" }));

    tauri::async_runtime::spawn(async move {
        let polls = pairing.expires_in / POLL_EVERY.as_secs() + 1;
        for _ in 0..polls {
            tokio::time::sleep(POLL_EVERY).await;
            let state = app.state::<AiState>();
            if state.0.lock().await.login != generation {
                return;
            }
            match auth::poll_pairing(&app, &pairing.id, &device_key).await {
                Ok(PairingState::Pending) => {}
                Ok(PairingState::Complete(session)) => {
                    let user = user_of(&session);
                    if let Err(e) = auth::save(&app, &session) {
                        emit(&app, json!({ "type": "ai:auth", "status": "error", "message": e }));
                        return;
                    }
                    state.0.lock().await.session = Some(*session);
                    info!("Sesión del asistente iniciada");
                    emit(&app, json!({ "type": "ai:auth", "status": "complete", "user": user }));
                    return;
                }
                Ok(PairingState::Expired) => break,
                Err(e) => warn!("No se pudo consultar el inicio de sesión: {}", e),
            }
        }
        emit(&app, json!({ "type": "ai:auth", "status": "expired" }));
    });
    Ok(())
}

#[tauri::command]
pub async fn ai_logout(app: AppHandle, state: State<'_, AiState>) -> Result<(), String> {
    let mut inner = state.0.lock().await;
    inner.login += 1;
    inner.socket = None;
    inner.pending.clear();
    let fresh = inner.session(&app).signed_out();
    auth::save(&app, &fresh)?;
    inner.session = Some(fresh);
    emit(&app, json!({ "type": "ai:auth", "status": "signed_out" }));
    Ok(())
}

async fn send_raw(state: &State<'_, AiState>, message: Value) -> Result<(), String> {
    let inner = state.0.lock().await;
    let socket = inner.socket.as_ref().ok_or("No hay conexión con el asistente.")?;
    socket.send(message.to_string()).map_err(|_| "Se perdió la conexión con el asistente.".to_string())
}

#[tauri::command]
pub async fn ai_send(app: AppHandle, state: State<'_, AiState>, project_name: String, content: String, session_id: Option<String>) -> Result<(), String> {
    let root = resolve_in_project(&app, &project_name, "")?;
    let working_directory = root.to_string_lossy().to_string();
    {
        let mut inner = state.0.lock().await;
        if !inner.session(&app).signed_in() {
            return Err(NOT_SIGNED_IN.into());
        }
        if inner.root.as_ref() != Some(&root) {
            // Another project: what was waiting for approval belonged to the old one.
            inner.pending.clear();
        }
        inner.root = Some(root);
    }
    socket::ensure_connected(&app, &state).await?;

    let mut message = json!({ "type": "chat:send", "content": content, "workingDirectory": working_directory });
    match session_id {
        Some(id) => message["sessionId"] = Value::String(id),
        // The skill only counts when the conversation is created, and the server refuses one it does not have.
        None if has_dischord_skill(&app, &state).await => message["skill"] = Value::String(DISCHORD_SKILL.into()),
        None => {}
    }
    send_raw(&state, message).await
}

async fn has_dischord_skill(app: &AppHandle, state: &State<'_, AiState>) -> bool {
    let token = {
        let mut inner = state.0.lock().await;
        if let Some(known) = inner.has_dischord_skill {
            return known;
        }
        inner.session(app).access_token.clone()
    };
    let Some(names) = auth::skill_names(app, &token).await else { return false };
    let known = names.iter().any(|name| name == DISCHORD_SKILL);
    state.0.lock().await.has_dischord_skill = Some(known);
    known
}

#[tauri::command]
pub async fn ai_cancel(state: State<'_, AiState>, session_id: String) -> Result<(), String> {
    send_raw(&state, json!({ "type": "chat:cancel", "sessionId": session_id })).await
}

#[tauri::command]
pub async fn ai_command_respond(app: AppHandle, state: State<'_, AiState>, command_id: String, approved: bool) -> Result<(), String> {
    let pending = state.0.lock().await.pending.remove(&command_id);
    let Some(pending) = pending else { return Ok(()) };

    if approved {
        if pending.server_asked {
            send_raw(&state, json!({ "type": "command:respond", "commandId": command_id, "approved": true })).await?;
        }
        socket::execute(app, pending.command, pending.root).await;
        return Ok(());
    }

    let refusal = if pending.server_asked {
        json!({ "type": "command:respond", "commandId": command_id, "approved": false })
    } else {
        json!({ "type": "command:result", "commandId": command_id, "status": "error", "output": "El usuario rechazó el comando." })
    };
    send_raw(&state, refusal).await?;
    emit(&app, json!({ "type": "ai:command", "commandId": command_id, "status": "rejected", "summary": socket::summary_for(&pending.command) }));
    Ok(())
}
