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

pub fn setup_logger(log_dir: PathBuf, rotation: LogRotation) -> Result<(), fern::InitError> {
    if !log_dir.exists() {
        let _ = fs::create_dir_all(&log_dir);
    }

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
