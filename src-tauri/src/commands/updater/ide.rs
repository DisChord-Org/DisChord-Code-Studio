use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use tauri_plugin_updater::UpdaterExt;
use log::{info, error, warn};

use super::window::open_update_window;

pub async fn run_ide_update(app_handle: tauri::AppHandle) {
    super::emit_progress(&app_handle, "ide", "checking", None, None, None, None, None);

    let updater = match app_handle.updater() {
        Ok(u) => u,
        Err(e) => {
            error!("No se pudo obtener el servicio de updater: {}", e);
            super::emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            info!("Actualización del IDE encontrada: {}", version);

            if let Err(e) = open_update_window(&app_handle) {
                warn!("No se pudo abrir la ventana de actualización para el IDE: {}", e);
            }

            super::emit_progress(&app_handle, "ide", "downloading", Some(0.0), Some(0), None, Some(version.clone()), None);

            let downloaded = Arc::new(AtomicU64::new(0));
            let downloaded_clone = downloaded.clone();
            let progress_handle = app_handle.clone();
            let version_clone = version.clone();

            let install_result = update.download_and_install(
                move |chunk_len, total_len| {
                    let total = downloaded_clone.fetch_add(chunk_len as u64, Ordering::SeqCst) + chunk_len as u64;
                    let percent = total_len.map(|t| if t > 0 { (total as f64 / t as f64) * 100.0 } else { 0.0 });
                    super::emit_progress(&progress_handle, "ide", "downloading", percent, Some(total), total_len, Some(version_clone.clone()), None);
                },
                || {
                    info!("Descarga del IDE finalizada, instalando...");
                }
            ).await;

            match install_result {
                Ok(_) => {
                    super::emit_progress(&app_handle, "ide", "installing", Some(100.0), None, None, Some(version.clone()), None);
                    info!("IDE actualizado correctamente a {}", version);
                    super::emit_progress(&app_handle, "ide", "done", Some(100.0), None, None, Some(version), None);
                },
                Err(e) => {
                    error!("Error al instalar la actualización del IDE: {}", e);
                    super::emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
                }
            }
        },
        Ok(None) => {
            info!("El IDE está actualizado");
            super::emit_progress(&app_handle, "ide", "up_to_date", None, None, None, None, None);
        },
        Err(e) => {
            error!("Error al comprobar actualizaciones del IDE: {}", e);
            super::emit_progress(&app_handle, "ide", "error", None, None, None, None, Some(e.to_string()));
        }
    }
}
