use log::error;

pub trait LogErr<T> {
    fn log_err(self, context: &str) -> Result<T, String>;
}

impl<T, E: std::fmt::Display> LogErr<T> for Result<T, E> {
    fn log_err(self, context: &str) -> Result<T, String> {
        self.map_err(|e| {
            let message = format!("{}: {}", context, e);
            error!("{}", message);
            message
        })
    }
}
