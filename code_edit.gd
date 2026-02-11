extends CodeEdit

func _ready() -> void:
	set_draw_line_numbers(true)
	set_highlight_current_line(true)
	set_draw_tabs(true)
	set_indent_size(4)
	
	set_code_completion_enabled(true)
	
	var highlighter = CodeHighlighter.new()
	highlighter.add_keyword_color("si", Color.CORNFLOWER_BLUE) # just a test
	
	self.syntax_highlighter = highlighter
