extends Control

@onready var selector = $SelectFolder

func _on_btn_open_pressed() -> void:
	selector.popup_centered()

func _on_select_folder_dir_selected(dir: String) -> void:
	var next_scene = load("res://Scenes/Editor.tscn").instantiate()
	next_scene.project_path = dir
	
	# swaping scenes
	get_tree().root.add_child(next_scene)
	get_tree().current_scene = next_scene
	queue_free()
