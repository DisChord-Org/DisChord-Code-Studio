use super::*;

const HELLO_SHA: &str = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("dischord-test-{}-{}", name, std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn sha256_of_known_input() {
    assert_eq!(sha256_hex(b"hello"), HELLO_SHA);
}

#[test]
fn finds_checksum_in_listing() {
    let other = "a".repeat(64);
    let text = format!("{other}  node-v22.1.0-linux-x64.tar.xz\n{HELLO_SHA}  node-v22.1.0-win-x64.zip\n{other} *star.zip\n");
    assert_eq!(find_checksum(&text, "node-v22.1.0-win-x64.zip").as_deref(), Some(HELLO_SHA));
    assert_eq!(find_checksum(&text, "star.zip").as_deref(), Some(other.as_str()));
    assert_eq!(find_checksum(&text, "node-v22.1.0-win-x64.zip.sig"), None);
    assert_eq!(find_checksum("not a hash  file.zip", "file.zip"), None);
}

#[test]
fn bare_sidecar_hash_is_accepted() {
    let upper = HELLO_SHA.to_ascii_uppercase();
    assert_eq!(find_checksum(&format!("{upper}\n"), "anything").as_deref(), Some(HELLO_SHA));
}

#[test]
fn node_dir_is_separate_from_legacy() {
    let home = Path::new("/home/u");
    assert_eq!(unix_node_dir(home), home.join(".local/share/dischord/node"));
    assert_eq!(legacy_node_dir(home), home.join(".local/bin/node"));
}

#[test]
fn migrate_moves_legacy_dir_once() {
    let root = temp("migrate");
    let (old, new) = (root.join("bin").join("node"), root.join("share").join("dischord").join("node"));
    fs::create_dir_all(old.join("bin")).unwrap();
    fs::write(old.join("bin").join("x"), "data").unwrap();
    assert!(migrate_dir(&old, &new).unwrap());
    assert!(!old.exists());
    assert_eq!(fs::read_to_string(new.join("bin").join("x")).unwrap(), "data");
    assert!(!migrate_dir(&old, &new).unwrap());
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn migrate_skips_when_new_exists_or_old_is_a_file() {
    let root = temp("migrate-skip");
    let (old, new) = (root.join("node"), root.join("new"));
    fs::write(&old, "user binary").unwrap();
    assert!(!migrate_dir(&old, &new).unwrap());
    assert!(old.is_file());
    fs::remove_file(&old).unwrap();
    fs::create_dir_all(&old).unwrap();
    fs::create_dir_all(&new).unwrap();
    assert!(!migrate_dir(&old, &new).unwrap());
    assert!(old.is_dir());
    let _ = fs::remove_dir_all(&root);
}

const RELEASE: &str = r#"{"assets":[
  {"name":"chord-x86_64-pc-windows-msvc.exe","digest":"sha256:099279EB5D59E3CA712944B42A6A824AC80A6CDAEE15EF14CFB1454A43086E42"},
  {"name":"chord-x86_64-unknown-linux-gnu","digest":"md5:abc"},
  {"name":"chord-aarch64-apple-darwin"}
]}"#;

#[test]
fn reads_github_asset_digest() {
    let expected = "099279eb5d59e3ca712944b42a6a824ac80a6cdaee15ef14cfb1454a43086e42";
    assert_eq!(digest_from_release(RELEASE, "chord-x86_64-pc-windows-msvc.exe").as_deref(), Some(expected));
}

#[test]
fn ignores_missing_or_malformed_digests() {
    assert_eq!(digest_from_release(RELEASE, "chord-x86_64-unknown-linux-gnu"), None);
    assert_eq!(digest_from_release(RELEASE, "chord-aarch64-apple-darwin"), None);
    assert_eq!(digest_from_release(RELEASE, "no-such-asset"), None);
    assert_eq!(digest_from_release("not json", "x"), None);
}

#[test]
fn picks_pnpm_asset_per_platform() {
    assert_eq!(pnpm_asset_name("windows", "x86_64").unwrap(), "pnpm-win32-x64.zip");
    assert_eq!(pnpm_asset_name("macos", "aarch64").unwrap(), "pnpm-darwin-arm64.tar.gz");
    assert_eq!(pnpm_asset_name("linux", "x86_64").unwrap(), "pnpm-linux-x64.tar.gz");
    assert!(pnpm_asset_name("freebsd", "x86_64").is_err());
    assert!(pnpm_asset_name("linux", "riscv64").is_err());
}
