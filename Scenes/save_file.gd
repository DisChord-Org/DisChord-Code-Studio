extends Button

@onready var code_edit = $"../../HSplitContainer/VSplitContainer/CodeEdit"
@onready var root_editor = $"../../.."

func _input(event):
	if event is InputEventKey:
		# ctrl + s = save current file
		if event.ctrl_pressed and event.keycode == KEY_S and event.pressed:
			get_viewport().set_input_as_handled()
			_on_save_pressed()

# save current file
func _on_save_pressed():
	var path = root_editor.current_file_path
	
	if path == "":
		return
		
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file:
		file.store_string(code_edit.text)
		file.close()
