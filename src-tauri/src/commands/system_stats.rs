use serde::Serialize;
use std::sync::Mutex;
use sysinfo::System;

#[derive(Serialize)]
pub struct SystemStats {
    cpu_percent: f32,
    ram_used_mb: f64,
    ram_total_mb: f64,
    ram_percent: f32,
}

#[tauri::command]
pub fn get_system_stats(state: tauri::State<Mutex<System>>) -> SystemStats {
    let mut sys = state.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_percent = sys.global_cpu_usage();
    let ram_used_mb = sys.used_memory() as f64 / 1024.0 / 1024.0;
    let ram_total_mb = sys.total_memory() as f64 / 1024.0 / 1024.0;
    let ram_percent = if ram_total_mb > 0.0 {
        (ram_used_mb / ram_total_mb * 100.0) as f32
    } else {
        0.0
    };

    SystemStats { cpu_percent, ram_used_mb, ram_total_mb, ram_percent }
}