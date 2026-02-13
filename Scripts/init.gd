extends Control

# DOES NOT WORK ON LINUX YET

# main paths
var base_path = OS.get_system_dir(OS.SYSTEM_DIR_DOCUMENTS) + "/DisChordWorkflow"
var workspace_path = base_path + "/Workspaces"
var dischord_repo_path = base_path + "/DisChord"

@onready var project_list = $CenterContainer/VBoxContainer/ScrollContainer/VBoxContainer
@onready var dialog = $NewProjectDialog

func _ready():
	_setup_environment()
	_load_projects()

func _setup_environment():
	# mkdirs
	for path in [base_path, workspace_path]:
		if not DirAccess.dir_exists_absolute(path):
			DirAccess.make_dir_recursive_absolute(path)
	
	# cloning dischord
	if not DirAccess.dir_exists_absolute(dischord_repo_path):
		OS.execute("git", ["clone", "https://github.com/DisChord-Org/DisChord.git", dischord_repo_path], [], true)
		OS.execute("cmd.exe", ["/c", "cd /d " + dischord_repo_path + " && " + "pnpm install"], [], true)

func _load_projects():
	# clearing list
	for node in project_list.get_children():
		node.queue_free()
	
	var dir = DirAccess.open(workspace_path)
	dir.list_dir_begin()
	var folder = dir.get_next()
	
	while folder != "":
		if dir.current_is_dir() and folder != "." and folder != "..":
			_create_project_button(folder)
		folder = dir.get_next()

func _create_project_button(project_name):
	var btn = Button.new()
	btn.text = "📂 " + project_name
	btn.alignment = HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT
	btn.pressed.connect(_on_project_selected.bind(project_name))
	project_list.add_child(btn)

func _on_project_selected(project_name):
	# swap scene
	var full_path = workspace_path + "/" + project_name
	var next_scene = load("res://Scenes/Editor.tscn").instantiate()

	next_scene.project_path = full_path
	get_tree().root.add_child(next_scene)
	get_tree().current_scene = next_scene
	queue_free()

func _on_new_project_button_pressed():
	# sking proyect name
	dialog.popup_centered()

func _on_new_project_dialog_confirmed():
	var project_name = $NewProjectDialog/LineEdit.text 
	
	if project_name == "":
		return
	
	var project_path = workspace_path + "/" + project_name
	
	# mkdir src
	DirAccess.make_dir_recursive_absolute(project_path + "/src")
	
	# touch index.chord in src
	var f = FileAccess.open(project_path + "/src/index.chord", FileAccess.WRITE)
	f.store_string("// Nuevo proyecto DisChord")
	f.close()
	
	# init commands
	var cmd = "cd /d " + project_path + " && pnpm init && pnpm install seyfert"
	OS.execute("cmd.exe", ["/c", cmd], [], true)
	
	_load_projects() # refresh list
