use std::time::Duration;

use serde::Deserialize;
use log::{info, warn};

const STATUS_URL: &str = "https://hayahora.futbol/estado/data.json";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Deserialize)]
struct Report {
    data: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
    #[serde(rename = "stateChanges")]
    state_changes: Vec<StateChange>,
}

#[derive(Deserialize)]
struct StateChange {
    state: bool,
}

/// Whether the football league is blocking IPs right now: "blocked", "clear" or "unknown" when
/// the status page cannot be read (it can be blocked too).
#[tauri::command]
pub async fn check_league_block() -> String {
    match fetch_blocked().await {
        Ok(true) => "blocked",
        Ok(false) => "clear",
        Err(e) => {
            warn!("No se pudo consultar el estado de los bloqueos de LaLiga: {}", e);
            "unknown"
        }
    }
    .to_string()
}

async fn fetch_blocked() -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(REQUEST_TIMEOUT).build().map_err(|e| e.to_string())?;
    let report: Report = client
        .get(STATUS_URL)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let blocked = report.data.iter().any(|entry| entry.state_changes.last().is_some_and(|last| last.state));
    info!("Bloqueos de LaLiga activos: {}", blocked);
    Ok(blocked)
}
