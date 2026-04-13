use std::fs;
use std::path::PathBuf;

pub fn setup_logger(log_dir: PathBuf) -> Result<(), fern::InitError> {
    if !log_dir.exists() {
        let _ = fs::create_dir_all(&log_dir);
    }

    let mut log_path = log_dir;
    log_path.push("app_debug.log");

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