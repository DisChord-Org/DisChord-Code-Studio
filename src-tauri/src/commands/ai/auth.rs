use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;

use log::warn;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Manager;

use crate::log_err::LogErr;

pub const API_URL: &str = "https://amaya-api.theindiebrand.es";
pub const WS_URL: &str = "wss://amaya-api.theindiebrand.es/ws";
const SESSION_FILE: &str = "ai_session.json";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const DEVICE_NAME: &str = "DisChord Code Studio";
const USER_AGENT: &str = concat!("DisChord-Code-Studio/", env!("CARGO_PKG_VERSION"));

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct StoredSession {
    pub device_key: String,
    pub access_token: String,
    pub refresh_token: String,
    pub device_id: String,
    pub user: Option<Value>,
}

impl StoredSession {
    pub fn signed_out(&self) -> Self {
        StoredSession { device_key: self.device_key.clone(), ..Default::default() }
    }

    pub fn signed_in(&self) -> bool {
        !self.access_token.is_empty() && !self.refresh_token.is_empty()
    }
}

fn session_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(SESSION_FILE))
}

pub fn load(app: &tauri::AppHandle) -> StoredSession {
    let mut session = session_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<StoredSession>(&raw).ok())
        .unwrap_or_default();
    if session.device_key.is_empty() {
        session.device_key = uuid::Uuid::new_v4().to_string();
    }
    session
}

pub fn save(app: &tauri::AppHandle, session: &StoredSession) -> Result<(), String> {
    let path = session_path(app)?;
    let json = serde_json::to_string(session).map_err(|e| e.to_string())?;
    fs::write(&path, json).log_err("No se pudo guardar la sesión del asistente")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

pub fn client_version(app: &tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

fn http() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| reqwest::Client::builder().user_agent(USER_AGENT).timeout(REQUEST_TIMEOUT).build().expect("el cliente HTTP debe poder crearse"))
}

fn url(path: &str) -> String {
    format!("{}{}", API_URL, path)
}

pub struct Pairing {
    pub id: String,
    pub verification_url: String,
    pub expires_in: u64,
}

pub async fn start_pairing(app: &tauri::AppHandle, device_key: &str) -> Result<Pairing, String> {
    let response = http()
        .post(url("/auth/pairing/start"))
        .header("X-Amaya-Client", client_version(app))
        .json(&json!({ "deviceName": DEVICE_NAME, "deviceKey": device_key }))
        .send()
        .await
        .log_err("No se pudo contactar con el servidor")?;
    if !response.status().is_success() {
        return Err(format!("El servidor rechazó el inicio de sesión ({}).", response.status()));
    }
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    let field = |key: &str| body.get(key).and_then(Value::as_str).map(str::to_string);
    Ok(Pairing {
        id: field("pairingId").ok_or("Respuesta del servidor no válida.")?,
        verification_url: field("verificationUrl").ok_or("Respuesta del servidor no válida.")?,
        expires_in: body.get("expiresIn").and_then(Value::as_u64).unwrap_or(300),
    })
}

pub enum PairingState {
    Pending,
    Complete(Box<StoredSession>),
    Expired,
}

pub async fn poll_pairing(app: &tauri::AppHandle, pairing_id: &str, device_key: &str) -> Result<PairingState, String> {
    let response = http()
        .get(url(&format!("/auth/pairing/{}", pairing_id)))
        .header("X-Amaya-Client", client_version(app))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status().as_u16() == 404 {
        return Ok(PairingState::Expired);
    }
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    if body.get("status").and_then(Value::as_str) != Some("complete") {
        return Ok(PairingState::Pending);
    }
    let text = |key: &str| body.get(key).and_then(Value::as_str).unwrap_or_default().to_string();
    Ok(PairingState::Complete(Box::new(StoredSession {
        device_key: device_key.to_string(),
        access_token: text("accessToken"),
        refresh_token: text("refreshToken"),
        device_id: text("deviceId"),
        user: body.get("user").cloned(),
    })))
}

pub async fn refresh(app: &tauri::AppHandle, session: &StoredSession) -> Result<StoredSession, String> {
    let response = http()
        .post(url("/auth/refresh"))
        .header("X-Amaya-Client", client_version(app))
        .json(&json!({ "refreshToken": session.refresh_token, "deviceId": session.device_id }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err("La sesión ha caducado. Vuelve a iniciar sesión.".into());
    }
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    let text = |key: &str| body.get(key).and_then(Value::as_str).map(str::to_string);
    let (Some(access), Some(refresh)) = (text("accessToken"), text("refreshToken")) else {
        return Err("Respuesta del servidor no válida.".into());
    };
    Ok(StoredSession { access_token: access, refresh_token: refresh, ..session.clone() })
}

pub enum MeError {
    Unauthorized,
    Other(String),
}

pub async fn me(app: &tauri::AppHandle, access_token: &str) -> Result<Value, MeError> {
    let response = http()
        .get(url("/auth/me"))
        .bearer_auth(access_token)
        .header("X-Amaya-Client", client_version(app))
        .send()
        .await
        .map_err(|e| MeError::Other(e.to_string()))?;
    match response.status().as_u16() {
        401 => Err(MeError::Unauthorized),
        code if !(200..300).contains(&code) => Err(MeError::Other(format!("El servidor respondió {}.", code))),
        _ => response.json().await.map_err(|e| MeError::Other(e.to_string())),
    }
}

const AVATAR_HOSTS: [&str; 2] = ["cdn.discordapp.com", "media.discordapp.net"];
const MAX_AVATAR_BYTES: usize = 1024 * 1024;

pub async fn avatar_data_url(avatar_url: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(avatar_url).ok();
    let allowed = parsed.as_ref().is_some_and(|u| u.scheme() == "https" && u.host_str().is_some_and(|host| AVATAR_HOSTS.contains(&host)));
    let Some(parsed) = parsed.filter(|_| allowed) else {
        warn!("No se descarga el avatar: la dirección no es de Discord ({})", avatar_url.split('?').next().unwrap_or_default());
        return None;
    };

    let response = match http().get(parsed).send().await {
        Ok(response) => response,
        Err(e) => {
            warn!("No se pudo descargar el avatar: {}", e);
            return None;
        }
    };
    if !response.status().is_success() {
        warn!("El CDN de Discord respondió {} al pedir el avatar", response.status());
        return None;
    }
    let kind = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or_default().to_string();
    if !kind.starts_with("image/") {
        warn!("El avatar no es una imagen ({})", kind);
        return None;
    }
    let bytes = response.bytes().await.ok()?;
    if bytes.len() > MAX_AVATAR_BYTES {
        warn!("El avatar es demasiado grande ({} bytes)", bytes.len());
        return None;
    }

    use base64::Engine;
    Some(format!("data:{};base64,{}", kind, base64::engine::general_purpose::STANDARD.encode(bytes)))
}

pub async fn skill_names(app: &tauri::AppHandle, access_token: &str) -> Option<Vec<String>> {
    let response = http()
        .get(url("/skills"))
        .bearer_auth(access_token)
        .header("X-Amaya-Client", client_version(app))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let skills: Vec<Value> = response.json().await.ok()?;
    Some(skills.iter().filter_map(|s| s.get("name").and_then(Value::as_str).map(str::to_string)).collect())
}
