mod commands;

use std::sync::{Arc, Mutex};
use std::process::Child;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use tauri_plugin_updater::UpdaterExt;
use tauri::Manager;

pub struct ChildProcessState(pub Arc<Mutex<Option<Child>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.center();
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(Some(update)) = handle.updater().expect("Error al obtener updater").check().await {
                    let _ = update.download_and_install(|_, _| {}, || {}).await;
                }
            });

            let mut client = DiscordIpcClient::new("1481205770489167973");
            
            std::thread::spawn(move || {
                if client.connect().is_ok() {
                    let _ = client.set_activity(activity::Activity::new()
                        .state("Programando en DisChord")
                        .assets(activity::Assets::new().large_image("logo_main"))
                    );
                    
                    loop { std::thread::sleep(std::time::Duration::from_secs(15)); }
                }
            });

            if let Err(e) = commands::process::setup_environment(app) {
                eprintln!("Error instalando herramientas: {}", e);
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
        .expect("error while running tauri application");
}
