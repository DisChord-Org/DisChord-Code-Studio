mod commands;
mod logger;

use std::sync::{Arc, Mutex};
use std::process::Child;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use tauri_plugin_updater::UpdaterExt;
use tauri::Manager;
use log::{info, error, warn};

pub struct ChildProcessState(pub Arc<Mutex<Option<Child>>>);

pub struct DiscordState {
    pub client: Arc<Mutex<Option<DiscordIpcClient>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let discord_client = Arc::new(Mutex::new(None));

    let discord_state = discord_client.clone();
    let setup_client = discord_client.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DiscordState { client: discord_state })
        .setup(move |app| {
            // app_log_dir() resuelve automáticamente:
            // macOS: ~/Library/Logs/com.dischord.code.studio/
            // Linux: ~/.local/share/com.dischord.code.studio/logs/
            // Windows: %APPDATA%/com.dischord.code.studio/logs/
            if let Ok(log_dir) = app.path().app_log_dir() {
                if let Err(e) = logger::setup_logger(log_dir) {
                    eprintln!("Error inicializando el logger: {}", e);
                }
            }

            info!("DisChord IDE iniciado");

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.center();
                info!("Ventana principal centrada.");
            } else {
                warn!("No se pudo encontrar la ventana principal 'main'");
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                info!("Comprobando actualizaciones");
                match handle.updater() {
                    Ok(updater) => {
                        match updater.check().await {
                            Ok(Some(update)) => {
                                info!("Actualización encontrada: {}. Descargando", update.version);
                                if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
                                    error!("Error al instalar la actualización: {}", e);
                                }
                            },
                            Ok(None) => info!("La aplicación está actualizada"),
                            Err(e) => error!("Error al comprobar actualizaciones: {}", e),
                        }
                    },
                    Err(e) => error!("No se pudo obtener el servicio de updater: {}", e),
                }
            });

            let inner_client_arc = setup_client.clone();
            
            std::thread::spawn(move || {
                let mut client = DiscordIpcClient::new("1481205770489167973");

                info!("Intentando conectar con Discord RPC");

                if client.connect().is_ok() {
                    if let Ok(mut guard) = inner_client_arc.lock() {
                        *guard = Some(client);
                    }

                    let _ = update_presence(&inner_client_arc, "Viendo proyectos", "Inicio");
                } else {
                    warn!("No se pudo conectar con Discord");
                }
            });

            info!("Configurando entorno de comandos");
            if let Err(e) = commands::process::setup_environment(app) {
                error!("ERROR CRÍTICO instalando herramientas: {}", e);
            } else {
                info!("Entorno configurado correctamente");
            }
            
            Ok(())
        })
        .manage(ChildProcessState(Arc::new(Mutex::new(None))))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::create_projects_folder,
            commands::project::get_projects,
            commands::project::create_new_project,
            commands::project::delete_project,

            commands::file::read_project_files,
            commands::file::read_file_content,
            commands::file::save_file_content,
            commands::file::create_new_file,
            commands::file::create_new_folder,
            commands::file::delete_item,

            commands::process::run_chord_project,
            commands::process::stop_chord_project,
            commands::process::update_chord_system,
            commands::process::open_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("Error fatal al ejecutar la aplicación Tauri");
}

pub fn update_presence(client_arc: &Arc<Mutex<Option<DiscordIpcClient>>>, state: &str, details: &str) -> Result<(), String> {
    if let Ok(mut guard) = client_arc.lock() {
        if let Some(client) = guard.as_mut() {
            let res = client.set_activity(activity::Activity::new()
                .state(state)
                .details(details)
                .assets(activity::Assets::new()
                    .large_image("logo_main")
                    .large_text("DisChord IDE")
                )
            );
            
            if res.is_ok() {
                info!("Presencia de Discord actualizada: {} | {}", details, state);
            }
            return res.map_err(|e| e.to_string());
        }
    }
    Ok(())
}