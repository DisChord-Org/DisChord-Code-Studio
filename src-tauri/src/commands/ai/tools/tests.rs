use super::*;

#[test]
fn git_branch_only_lists() {
    for ok in ["git branch", "git branch --list", "git branch -a", "git branch -v", "git branch -vv", "git branch -r"] {
        assert!(is_minor_command(ok), "{ok}");
    }
    for bad in ["git branch -D main", "git branch -f main HEAD", "git branch -m old new", "git branch newbranch", "git branch -a -D"] {
        assert!(!is_minor_command(bad), "{bad}");
    }
}

#[test]
fn ls_rejects_absolute_paths() {
    for bad in ["ls C:/Windows", "ls c:/", "ls /etc", "ls ../x", "ls D:foo", "ls src C:/x"] {
        assert!(!is_minor_command(bad), "{bad}");
    }
    for ok in ["ls", "ls -la", "ls src", "ls src/components"] {
        assert!(is_minor_command(ok), "{ok}");
    }
}

#[test]
fn read_only_git_still_allowed() {
    for ok in ["git status", "git log", "git log --oneline -n 5", "git rev-parse HEAD", "git --version", "pwd"] {
        assert!(is_minor_command(ok), "{ok}");
    }
    assert!(!is_minor_command("git log -p"));
    assert!(!is_minor_command("git push"));
}

#[test]
fn git_rejects_colon_and_outside_paths() {
    for bad in ["git log HEAD:secret.txt", "git show HEAD:.env", "git rev-parse HEAD:file", "git log main:src/a", "git log -- /etc/passwd", "git log ../x", "git log C:/x", "git status ../.."] {
        assert!(!is_minor_command(bad), "{bad}");
    }
    for ok in ["git log main", "git log origin/main", "git log HEAD^", "git log -- src/a.rs", "git rev-parse --abbrev-ref HEAD"] {
        assert!(is_minor_command(ok), "{ok}");
    }
}

#[test]
fn secret_files_are_detected() {
    for p in [
        ".env", ".ENV", ".env.local", ".Env.Production", "sub/dir/.env", "a/b/.npmrc", ".NETRC", ".pypirc",
        "server.pem", "x/Cert.PEM", "private.key", "a/b/store.p12", "store.PFX", "id_rsa", "id_rsa.pub", "ssh/ID_ED25519",
        "credentials", "credentials.json", "aws/Credentials", "secrets.json", "bot/Secret.yaml", "token", "TOKEN", "tokens.json",
        "discord.token", "bot/ai_session.json", "AI_SESSION.JSON",
    ] {
        assert!(is_secret_file(Path::new(p)), "{p}");
    }
}

#[test]
fn normal_files_are_not_secret() {
    for p in [
        "src/main.ts", "lib.rs", "README.md", "package.json", "config.json", "settings.json", "Cargo.toml", ".gitignore",
        ".env.example", "app/.ENV.SAMPLE", ".env.template", "tokenizer.rs", "keyboard.ts", "monkey.rs", "src/secretary.ts", "pnpm-lock.yaml",
    ] {
        assert!(!is_secret_file(Path::new(p)), "{p}");
    }
}

#[test]
fn search_and_find_skip_secret_files() {
    let root = std::env::temp_dir().join(format!("dischord_secret_test_{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(root.join("bot")).unwrap();
    fs::write(root.join("bot/credentials.json"), "NEEDLE_SECRET").unwrap();
    fs::write(root.join("bot/main.ts"), "NEEDLE_PUBLIC").unwrap();
    let args = serde_json::json!({ "pattern": "NEEDLE", "glob": "**/*" });
    let found = search_files(&root, &args).unwrap();
    assert!(found.contains("NEEDLE_PUBLIC") && !found.contains("NEEDLE_SECRET"), "{found}");
    let listed = find_files(&root, &serde_json::json!({ "pattern": "**/*" })).unwrap();
    assert!(!listed.contains("credentials"), "{listed}");
    assert!(confine(&root, "bot/credentials.json").is_err());
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn confine_blocks_git_case_insensitive() {
    let root = std::env::temp_dir();
    for p in [".git/config", ".GIT/config", ".Git/config"] {
        assert!(confine(&root, p).is_err(), "{p}");
    }
}
