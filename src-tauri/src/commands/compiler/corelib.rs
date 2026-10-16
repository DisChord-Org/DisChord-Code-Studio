use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;

use crate::platform::compiler_binary_path;

#[derive(PartialEq)]
pub(super) struct BinaryStamp {
    path: Option<PathBuf>,
    len: Option<u64>,
    modified: Option<SystemTime>,
}

pub(super) fn stamp(app_handle: &tauri::AppHandle) -> BinaryStamp {
    let path = compiler_binary_path(app_handle).filter(|p| p.exists());
    let metadata = path.as_ref().and_then(|p| std::fs::metadata(p).ok());

    BinaryStamp {
        path,
        len: metadata.as_ref().map(|m| m.len()),
        modified: metadata.and_then(|m| m.modified().ok()),
    }
}

pub(super) fn corelib_cache() -> std::sync::MutexGuard<'static, Option<(BinaryStamp, serde_json::Value)>> {
    CORELIB_CACHE.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

static CORELIB_CACHE: Mutex<Option<(BinaryStamp, serde_json::Value)>> = Mutex::new(None);
