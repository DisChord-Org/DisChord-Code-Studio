extends Control

func _ready() -> void:
	# maximize window
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
