extends Control

var project_path: String = ""

@onready var file_explorer = $VBoxContainer/HSplitContainer/FileExplorer
@onready var code_edit = $VBoxContainer/HSplitContainer/VSplitContainer/CodeEdit

func _ready() -> void:
	# maximize window
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
	if project_path != "":
		update_file_explorer()
	
	file_explorer.item_activated.connect(_on_file_item_activated)

func update_file_explorer():
	file_explorer.clear()
	var root = file_explorer.create_item()
	file_explorer.hide_root = true
	
	_fill_tree(project_path, root)

func _fill_tree(path: String, parent: TreeItem):
	var dir = DirAccess.open(path)
	if dir:
		dir.list_dir_begin()
		var file_name = dir.get_next()
		
		while file_name != "":
			if file_name != "." and file_name != "..":
				var item = file_explorer.create_item(parent)
				item.set_text(0, file_name)
				
				var full_path = path + "/" + file_name
				item.set_metadata(0, full_path)
				
				if dir.current_is_dir():
					item.set_custom_color(0, Color("#66d9ef")) # folders are Cyan
					_fill_tree(full_path, item) # subfolders
				else:
					if file_name.ends_with(".chord"):
						item.set_custom_color(0, Color("#e6db74")) # files are Yellow
			
			file_name = dir.get_next()

var current_file_path: String = ""

# file onclick
func _on_file_item_activated():
	var selected = file_explorer.get_selected()
	var file_path = selected.get_metadata(0)
	
	if FileAccess.file_exists(file_path):
		var content = FileAccess.get_file_as_string(file_path)
		current_file_path = file_path
		code_edit.text = content
