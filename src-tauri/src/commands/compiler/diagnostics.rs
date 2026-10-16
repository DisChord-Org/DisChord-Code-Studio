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

#[cfg(test)]
mod tests {
    use super::*;

    fn output(code: i32, stdout: &str, stderr: &str) -> Output {
        Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn code_with_errors_is_not_a_tool_failure() {
        let result = parse_check(&output(
            1,
            r#"{"ok":false,"diagnostics":[{"file":"/p/src/a.chord","phase":"Análisis","severity":"error","message":"mal","line":2,"column":9}]}"#,
            "",
        ));

        assert!(!result.ok);
        assert!(result.tool_error.is_none());
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].line, Some(2));
        assert_eq!(result.diagnostics[0].column, Some(9));
    }

    #[test]
    fn clean_code_has_no_diagnostics() {
        let result = parse_check(&output(0, r#"{"ok":true,"diagnostics":[]}"#, ""));

        assert!(result.ok);
        assert!(result.diagnostics.is_empty());
        assert!(result.tool_error.is_none());
    }

    #[test]
    fn exit_code_two_is_a_tool_failure() {
        let result = parse_check(&output(2, "", "Uso incorrecto"));

        assert!(!result.ok);
        assert_eq!(result.tool_error.as_deref(), Some("Uso incorrecto"));
    }

    #[test]
    fn output_that_is_not_json_is_a_tool_failure() {
        let result = parse_check(&output(1, "algo raro", ""));

        assert!(result.tool_error.is_some());
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn a_diagnostic_without_a_place_is_kept() {
        let result = parse_check(&output(1, r#"{"ok":false,"diagnostics":[{"message":"sin sitio"}]}"#, ""));

        assert_eq!(result.diagnostics[0].line, None);
        assert_eq!(result.diagnostics[0].severity, "error");
    }
}
