use serde::{Deserialize, Serialize};

use super::run::{combined_output, failure_reason, Output, EXIT_TOOL_FAILURE};

#[derive(Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    #[serde(default)]
    pub file: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default = "default_severity")]
    pub severity: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub line: Option<u32>,
    #[serde(default)]
    pub column: Option<u32>,
}

fn default_severity() -> String {
    "error".to_string()
}

#[derive(Serialize)]
pub struct CheckResult {
    pub ok: bool,
    pub diagnostics: Vec<Diagnostic>,
    pub tool_error: Option<String>,
}

#[derive(Deserialize)]
struct RawCheck {
    #[serde(default)]
    ok: bool,
    #[serde(default)]
    diagnostics: Vec<Diagnostic>,
}
pub(super) fn tool_failure(message: String) -> CheckResult {
    CheckResult { ok: false, diagnostics: Vec::new(), tool_error: Some(message) }
}

pub(super) fn parse_check(output: &Output) -> CheckResult {
    if output.code == Some(EXIT_TOOL_FAILURE) {
        return tool_failure(failure_reason(output));
    }

    match serde_json::from_str::<RawCheck>(output.stdout.trim()) {
        Ok(raw) => CheckResult { ok: raw.ok, diagnostics: raw.diagnostics, tool_error: None },
        Err(_) => tool_failure(combined_output(output)),
    }
}
