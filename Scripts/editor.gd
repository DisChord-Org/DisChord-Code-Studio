extends Control

func _ready() -> void:
	# maximize window
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)

var project_path: String = ""

func _on_run_pressed():
	if project_path == "":
		return
