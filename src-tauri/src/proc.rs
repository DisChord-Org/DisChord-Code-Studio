//! Shared process helpers: run a child with a timeout and read NDJSON output.

use std::io::{BufRead, BufReader, Read, Write};
use std::process::Child;
use std::thread;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;

pub struct Captured {
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
}

fn drain(mut pipe: impl Read + Send + 'static) -> thread::JoinHandle<String> {
    thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = pipe.read_to_end(&mut bytes);
        String::from_utf8_lossy(&bytes).into_owned()
    })
}

/// Waits for an already spawned child (stdout/stderr piped, stdin piped only if `stdin` is
/// given), capturing its output. When `timeout` expires `kill` is called and `timed_out` is set.
pub fn wait_with_timeout(
    mut child: Child,
    stdin: Option<String>,
    timeout: Duration,
    poll: Duration,
    kill: fn(&mut Child),
) -> Result<Captured, String> {
    if let (Some(text), Some(mut pipe)) = (stdin, child.stdin.take()) {
        thread::spawn(move || {
            let _ = pipe.write_all(text.as_bytes());
        });
    }

    let out = child.stdout.take().ok_or("Sin salida estándar")?;
    let err = child.stderr.take().ok_or("Sin salida de errores")?;
    let (out, err) = (drain(out), drain(err));

    let started = Instant::now();
    let (code, timed_out) = loop {
        match child.try_wait() {
            Ok(Some(status)) => break (status.code(), false),
            Ok(None) if started.elapsed() >= timeout => {
                kill(&mut child);
                let _ = child.wait();
                break (None, true);
            }
            Ok(None) => thread::sleep(poll),
            Err(e) => return Err(e.to_string()),
        }
    };

    Ok(Captured { code, stdout: out.join().unwrap_or_default(), stderr: err.join().unwrap_or_default(), timed_out })
}

/// Reads newline-delimited JSON, skipping unreadable and blank lines. `on_line` gets the trimmed
/// raw line and its parse result.
pub fn read_ndjson<T: DeserializeOwned>(pipe: impl Read, mut on_line: impl FnMut(&str, Result<T, serde_json::Error>)) {
    for line in BufReader::new(pipe).lines() {
        let Ok(line) = line else { continue };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        on_line(trimmed, serde_json::from_str::<T>(trimmed));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ndjson_skips_blank_and_reports_errors() {
        let data = b"{\"a\":1}\n\n  \nnot json\n{\"a\":2}\n";
        let mut seen: Vec<(String, Option<i64>)> = Vec::new();
        read_ndjson::<serde_json::Value>(&data[..], |raw, parsed| {
            seen.push((raw.to_string(), parsed.ok().and_then(|v| v["a"].as_i64())));
        });
        assert_eq!(seen.len(), 3);
        assert_eq!(seen[0].1, Some(1));
        assert_eq!(seen[1], ("not json".to_string(), None));
        assert_eq!(seen[2].1, Some(2));
    }
}
