use serde::{Deserialize, Serialize};

use super::run::{combined_output, failure_reason, Output, EXIT_TOOL_FAILURE};

#[derive(Clone, Serialize, Deserialize)]
pub struct Declaration {
    pub kind: String,
    pub name: String,
    #[serde(default)]
    pub container: Option<String>,
    pub start: Position,
    pub end: Position,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub column: u32,
}

#[derive(Serialize)]
pub struct DeclarationsResult {
    ok: bool,
    declarations: Vec<Declaration>,
    tool_error: Option<String>,
}

#[derive(Deserialize)]
struct RawEmit {
    #[serde(default)]
    ok: bool,
    #[serde(default)]
    declarations: Vec<Declaration>,
}

pub(super) fn declarations_failure(message: String) -> DeclarationsResult {
    DeclarationsResult { ok: false, declarations: Vec::new(), tool_error: Some(message) }
}

pub(super) fn parse_declarations(output: &Output) -> DeclarationsResult {
    if output.code == Some(EXIT_TOOL_FAILURE) {
        return declarations_failure(failure_reason(output));
    }

    match serde_json::from_str::<RawEmit>(output.stdout.trim()) {
        Ok(raw) => DeclarationsResult { ok: raw.ok, declarations: raw.declarations, tool_error: None },
        Err(_) => declarations_failure(combined_output(output)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn output(code: i32, stdout: &str, stderr: &str) -> Output {
        Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn reads_the_declarations_of_valid_code() {
        let result = parse_declarations(&output(
            0,
            r#"{"ok":true,"diagnostics":[],"schema":1,"emit":"ast","ast":[],"declarations":[{"kind":"parameter","name":"n","container":"saludar","start":{"line":3,"column":17},"end":{"line":3,"column":18}}]}"#,
            "",
        ));

        assert!(result.ok);
        assert_eq!(result.declarations.len(), 1);
        assert_eq!(result.declarations[0].container.as_deref(), Some("saludar"));
        assert_eq!(result.declarations[0].start.column, 17);
    }

    #[test]
    fn code_that_does_not_parse_has_no_declarations() {
        let result = parse_declarations(&output(1, r#"{"ok":false,"diagnostics":[{"message":"mal","line":1,"column":1}]}"#, ""));

        assert!(!result.ok);
        assert!(result.declarations.is_empty());
        assert!(result.tool_error.is_none());
    }
}
