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
