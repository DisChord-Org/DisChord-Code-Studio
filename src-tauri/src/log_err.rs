use log::error;

/// Extensión de `Result` para el patrón repetido en casi todos los comandos:
/// loggear el error con contexto y convertirlo a `String` para el frontend.
///
/// `resultado.map_err(|e| { error!("Fallo X: {}", e); format!("Fallo X: {}", e) })?`
/// se queda en `resultado.log_err("Fallo X")?`.
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
