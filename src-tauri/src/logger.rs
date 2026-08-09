use std::fs;
use std::path::PathBuf;

/// Cada cuánto se crea un fichero de log nuevo.
enum LogRotation {
    /// Un fichero nuevo cada día.
    Daily,
    /// Un fichero nuevo en cada arranque del IDE.
    Session,
    /// Un fichero nuevo cada hora.
    Hourly,
}

impl LogRotation {
    fn from_config_value(value: &str) -> Self {
        match value {
            "session" => LogRotation::Session,
            "hourly" => LogRotation::Hourly,
            _ => LogRotation::Daily,
        }
    }

    fn filename(&self) -> String {
        let now = chrono::Local::now();
        match self {
            LogRotation::Daily => format!("app_{}.log", now.format("%Y-%m-%d")),
            LogRotation::Hourly => format!("app_{}.log", now.format("%Y-%m-%d_%Hh")),
            LogRotation::Session => format!("app_{}.log", now.format("%Y-%m-%d_%H-%M-%S")),
        }
    }
}

pub fn setup_logger(log_dir: PathBuf, rotation: &str) -> Result<(), fern::InitError> {
    if !log_dir.exists() {
        let _ = fs::create_dir_all(&log_dir);
    }

    let mut log_path = log_dir;
    log_path.push(LogRotation::from_config_value(rotation).filename());

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
