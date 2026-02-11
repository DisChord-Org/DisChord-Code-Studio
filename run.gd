extends Button

@onready var terminal = $"../../HSplitContainer/Terminal"
@onready var code_edit = $"../../HSplitContainer/CodeEdit"

func _on_run_pressed():
	var os = OS.get_name() # Windows, macOS or Linux
	
	# check if nodejs is installed
	if not _check_command("node -v"):
		_log_err("Error: Node.js no está instalado.")
		return
	
	# check if pnpm is installed and tries to install it
	if not _check_command("pnpm -v"):
		_log_info("Instalando pnpm...")
		_run_command("npm", ["install", "-g", "pnpm"])
	
	var docs_path = OS.get_system_dir(OS.SYSTEM_DIR_DOCUMENTS)
	var repo_path = docs_path + "/DisChord"
	var repo_path_abs = ProjectSettings.globalize_path(repo_path)
	
	# if DisChord is not installed
	if not DirAccess.dir_exists_absolute(repo_path):
		_log_info("Clonando repositorio DisChord...")
		_run_command("git", ["clone", "https://github.com/DisChord-Org/DisChord", repo_path_abs])
	
	# pnpm install
	var node_modules_path = repo_path + "/node_modules"
	if not DirAccess.dir_exists_absolute(node_modules_path):
		_log_info("No se encontró node_modules. Instalando dependencia...")
		_log_info("Esto puede tardar un minuto, espera por favor...")
		
		if OS.get_name() == "Windows":
			OS.execute("cmd.exe", ["/c", "pnpm --dir \"" + repo_path_abs + "\" install"], [], true)
		else:
			OS.execute("pnpm", ["--dir", repo_path_abs, "install"], [], true)
		_log_info("Instalación completada.")
	
	# making chord test file
	var file_name = "temp_code.chord"
	var full_file_path = repo_path + "/" + file_name
	var file = FileAccess.open(full_file_path, FileAccess.WRITE)
	file.store_string(code_edit.text)
	file.close()

	_log_info("Compilando...")
	var output = []
	var exit_code
	
	if OS.get_name() == "Windows":
		var command = "pnpm --dir \"" + repo_path_abs + "\" run dev " + file_name
		exit_code = OS.execute("cmd.exe", ["/c", command], output, true)
	else:
		var command = "pnpm --dir " + repo_path_abs + " run dev " + file_name
		exit_code = OS.execute("sh", ["-c", command], output, true)
	
	for line in output:
		terminal.text += line
	
	_cleanup(repo_path, file_name)

func _check_command(cmd_check: String) -> bool:
	var out = []
	var c = "cmd.exe" if OS.get_name() == "Windows" else "sh"
	var a = ["/c", cmd_check] if OS.get_name() == "Windows" else ["-c", cmd_check]
	return OS.execute(c, a, out) == 0

func _run_command(cmd: String, args: Array):
	var out = []
	OS.execute(cmd, args, out, true)
	for line in out: terminal.text += line

func _log_info(msg: String):
	terminal.text += "[INFO] " + msg + "\n"

func _log_err(msg: String):
	terminal.text += "[ERROR] " + msg + "\n"

# cleaning files after testing
func _cleanup(path: String, fname: String):
	OS.delay_msec(500)
	var dir = DirAccess.open(path)
	if dir:
		dir.remove(fname)
		dir.remove(fname.replace(".chord", ".js"))
