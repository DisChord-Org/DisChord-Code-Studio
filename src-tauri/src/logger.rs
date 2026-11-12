use std::fs;
use std::path::PathBuf;

use crate::commands::config::LogRotation;

fn log_filename(rotation: LogRotation) -> String {
    let now = chrono::Local::now();
    match rotation {
        LogRotation::Daily => format!("app_{}.log", now.format("%Y-%m-%d")),
        LogRotation::Hourly => format!("app_{}.log", now.format("%Y-%m-%d_%Hh")),
        LogRotation::Session => format!("app_{}.log", now.format("%Y-%m-%d_%H-%M-%S")),
    }
}

const LOG_RETENTION_DAYS: u64 = 14;

fn prune_old_logs(log_dir: &std::path::Path) {
    let max_age = std::time::Duration::from_secs(LOG_RETENTION_DAYS * 24 * 60 * 60);
    let Ok(entries) = fs::read_dir(log_dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let is_log = path.extension().is_some_and(|e| e == "log")
            && path.file_name().is_some_and(|n| n.to_string_lossy().starts_with("app_"));
        if !is_log {
            continue;
        }
        let old = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.elapsed().ok())
            .is_some_and(|age| age > max_age);
        if old {
            let _ = fs::remove_file(&path);
        }
    }
}

pub fn setup_logger(log_dir: PathBuf, rotation: LogRotation) -> Result<(), fern::InitError> {
    if !log_dir.exists() {
        let _ = fs::create_dir_all(&log_dir);
    }

    prune_old_logs(&log_dir);

    let mut log_path = log_dir;
    log_path.push(log_filename(rotation));

    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "[{}][{}][{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.target(),
                message
            ))
        })
        .level(log::LevelFilter::Debug)
        .chain(std::io::stdout())
        .chain(fern::log_file(log_path)?)
        .apply()?;

    Ok(())
}
