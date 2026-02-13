extends Button

@onready var terminal = $"../../HSplitContainer/VSplitContainer/Terminal"
@onready var code_edit = $"../../HSplitContainer/VSplitContainer/CodeEdit"
@onready var root = $"../../../"
@onready var log_timer = $"../../../LogReaderTimer"

var current_pid: int = -1 # current proccess id
var log_file_path: String = ""
var file_cursor: int = 0 # to know where we're reading the logs

func _ready():
	log_file_path = root.project_path + "/bot_debug.log"
	log_timer.timeout.connect(_on_log_timer_timeout)

func _input(event: InputEvent):
	if event is InputEventKey:
		# ctrl + r for execute
		if event.ctrl_pressed and event.keycode == KEY_R and event.pressed:
			# this block the editor cz' sometimes it writes 'r'
			get_viewport().set_input_as_handled()
			_on_run_pressed()

func _on_run_pressed():
	if current_pid != -1:
		if OS.get_name() == "Windows":
			OS.execute("taskkill", ["/F", "/T", "/PID", str(current_pid)], [])
		else:
			OS.execute("kill", ["-9", "-" + str(current_pid)], [])
		
		OS.delay_msec(200)
		current_pid = -1
		_log_info("Se ha terminado el árbol de procesos anterior")
	else:
		terminal.text = ""
	
	log_timer.stop()
	
	# check if nodejs is installed
	if not _check_command("node"):
		_log_err("Node.js no está instalado.")
		return
	
	# check if pnpm is installed and tries to install it
	if not _check_command("pnpm"):
		_log_err("Instale pnpm.")
		return
	
	var docs_path = OS.get_system_dir(OS.SYSTEM_DIR_DOCUMENTS) + "/DisChordWorkflow"
	var repo_path = docs_path + "/DisChord" # compiler path
	
	# if DisChord is not installed
	if not DirAccess.dir_exists_absolute(repo_path):
		_log_err("DisChord no está instalado.")
		return
	
	# checking if node_modules
	var node_modules_path = repo_path + "/node_modules"
	if not DirAccess.dir_exists_absolute(node_modules_path):
		_log_err("No se encontró node_modules.")
		return
		
	# check repo path
	if root.project_path == "":
		_log_err("No se ha detectado la ruta del proyecto.")
		return
		
	var src_path = root.project_path + "/src"
	if not DirAccess.dir_exists_absolute(src_path):
		_log_err("No se encontró la carpeta 'src' en el proyecto.")
		return
	
	# if logs file exists
	if FileAccess.file_exists(log_file_path):
		DirAccess.remove_absolute(log_file_path)
	
	var file_name = "index.chord"
	var full_file_path = src_path + "/" + file_name
	
	var logs_file = FileAccess.open(log_file_path, FileAccess.WRITE)
	if not logs_file:
		# second plan temporally
		log_file_path = OS.get_user_data_dir() + "/last_bot_log.log"
		logs_file = FileAccess.open(log_file_path, FileAccess.WRITE)
	
	if logs_file:
		logs_file.store_string("") 
		logs_file.close()
		file_cursor = 0
	else:
		_log_err("Error crítico: No se puede escribir el log en ninguna ruta.")
		return
	
	# runtime workflow:
	# run command > log 2>&1
	var shell_cmd = ""
	var args = []
	
	if OS.get_name() == "Windows":
		shell_cmd = "cmd.exe"
		var pnpm_cmd = "pnpm --silent --dir \"" + repo_path + "\" run dev \"" + full_file_path + "\""
		var final_cmd = pnpm_cmd + " > \"" + log_file_path + "\" 2>&1"
		args = ["/c", final_cmd]
	else:
		shell_cmd = "sh"
		var env_setup = "export PATH=$PATH:$HOME/.local/share/pnpm:$HOME/.local/bin:/usr/local/bin;"
		var pnpm_cmd = "pnpm --silent --dir \"" + repo_path + "\" run dev \"" + full_file_path + "\""
		var final_cmd = env_setup + " " + pnpm_cmd + " > \"" + log_file_path + "\" 2>&1"
		args = ["-c", final_cmd]
	
	current_pid = OS.create_process(shell_cmd, args)
	
	if current_pid != -1:
		_log_info("Ejecutando (PID: %d)" % current_pid)
		log_timer.start()
	else:
		_log_err("Error al iniciar el proceso.")

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
	
	terminal.text = ''
	for line in out: terminal.text += line

func _on_log_timer_timeout():
	if not FileAccess.file_exists(log_file_path):
		return
	
	var file = FileAccess.open(log_file_path, FileAccess.READ)
	if file:
		file.seek(file_cursor) # last position
		
		var new_content = file.get_as_text() # reading everything
		
		if new_content != "":
			terminal.text += new_content
			if terminal.get_v_scroll_bar(): # autoscroll
				terminal.set_v_scroll(terminal.get_v_scroll_bar().max_value)
		
		file_cursor = file.get_position()
		file.close()

func _log_info(msg: String):
	terminal.text += "[INFO] " + msg + "\n"

func _log_err(msg: String):
	terminal.text += "[ERROR] " + msg + "\n"

# this make sures process is killed if user closes the editor
func _notification(what):
	if what == NOTIFICATION_PREDELETE:
		if current_pid != -1:
			OS.kill(current_pid)
