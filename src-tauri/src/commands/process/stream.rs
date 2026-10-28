use std::io::{BufRead, BufReader};
use std::process::{ChildStderr, ChildStdout};
use std::thread::{self, JoinHandle};

use tauri::AppHandle;

use crate::output::{emit_line, LineKind};

pub(super) fn stream_to_terminal(app_handle: &AppHandle, stdout: ChildStdout, stderr: ChildStderr) -> (JoinHandle<()>, JoinHandle<()>) {
    (
        stream_lines(app_handle.clone(), stdout, LineKind::Stdout),
        stream_lines(app_handle.clone(), stderr, LineKind::Stderr),
    )
}

fn stream_lines(app_handle: AppHandle, pipe: impl std::io::Read + Send + 'static, kind: LineKind) -> JoinHandle<()> {
    thread::spawn(move || {
        for line in BufReader::new(pipe).lines().map_while(Result::ok) {
            emit_line(&app_handle, kind, line);
        }
    })
}
