extends Button

@onready var terminal = $"../../HSplitContainer/Terminal"
@onready var code_edit = $"../../HSplitContainer/CodeEdit"

func _on_run_pressed():
	var os = OS.get_name() # Windows, macOS or Linux
	
	# check if nodejs is installed
	if not _check_command("node"):
		_log_err("Node.js no está instalado.")
		return
	
	# check if pnpm is installed and tries to install it
	if not _check_command("pnpm"):
		_log_err("Instale pnpm.")
		return
	
	var docs_path = OS.get_system_dir(OS.SYSTEM_DIR_DOCUMENTS)
	var repo_path = docs_path + "/DisChord"
	var repo_path_abs = ProjectSettings.globalize_path(repo_path)
	
	# if DisChord is not installed
	if not DirAccess.dir_exists_absolute(repo_path):
		_log_err("DisChord no está instalado.")
		return
	
	# checking if node_modules
	var node_modules_path = repo_path + "/node_modules"
	if not DirAccess.dir_exists_absolute(node_modules_path):
		_log_info("No se encontró node_modules.")
		return
	
	# making chord test file
	var file_name = "temp_code.chord"
	var full_file_path = repo_path + "/" + file_name
	var file = FileAccess.open(full_file_path, FileAccess.WRITE)
	file.store_string(code_edit.text)
	file.close()
	
	_log_info("Compilando...")
	
	if os == "Windows":
		var command = "pnpm --dir \"" + repo_path_abs + "\" run dev " + file_name
		_run_command("cmd.exe", [ "/c", command ])
	else:
		var command = "pnpm --dir " + repo_path_abs + " run dev " + file_name
		_run_command("sh", [ "-c", command ])
	
	_cleanup(repo_path, file_name)

func _check_command(cmd_check: String) -> bool:
	var out = []
	if OS.get_name() == "Windows":
		return OS.execute("cmd.exe", ["/c", "where " + cmd_check], out) == 0
	else:
		# linux is more complex. So i will export enviroment paths for pnpm
		var cmd = "export PATH=$PATH:$HOME/.local/share/pnpm:$HOME/.local/bin:/usr/local/bin;"
		return OS.execute("sh", ["-c", cmd, "command -v " + cmd_check], out) == 0

func _run_command(cmd: String, args: Array):
	var out = []
	
	if OS.get_name() == "Windows":
		OS.execute(cmd, args, out, true)
	else:
		var path_prefix = "export PATH=$PATH:$HOME/.local/share/pnpm:$HOME/.local/bin:/usr/local/bin; "
		var shell_command = path_prefix + args[1]
		var updated_args = ["-c", shell_command]
		OS.execute(cmd, updated_args, out, true)
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
