use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use log::{info, error};

fn force_focus(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();

    let window_clone = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(200));
        let _ = window_clone.set_always_on_top(false);
    });
}

pub fn open_update_window(app_handle: &tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app_handle.get_webview_window("update") {
        force_focus(&w);
        return Ok(());
    }

    info!("Abriendo ventana de actualización");

    let app_for_event = app_handle.clone();

    let window = WebviewWindowBuilder::new(app_handle, "update", WebviewUrl::App("index.html".into()))
        .title("Actualizando DisChord")
        .inner_size(800.0, 720.0)
        .min_inner_size(800.0, 720.0)
        .resizable(true)
        .maximizable(false)
        .decorations(false)
        .transparent(true)
        .center()
        .visible(false)
        .build()
        .map_err(|e| {
            error!("No se pudo crear la ventana de actualización: {}", e);
            e.to_string()
        })?;

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            info!("Ventana de actualización cerrada, restaurando la principal");
            if let Some(main) = app_for_event.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn mark_update_window_ready(app_handle: tauri::AppHandle) {
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.hide();
    }

    if let Some(update) = app_handle.get_webview_window("update") {
        force_focus(&update);
    }
}
