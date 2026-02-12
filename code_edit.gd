extends CodeEdit

func _ready() -> void:
	# basic config
	set_draw_line_numbers(true)
	set_highlight_current_line(true)
	set_draw_tabs(true)
	set_indent_size(4)
	set_code_completion_enabled(true) # text autocompletion
	
	set_auto_brace_completion_pairs({
		"(": ")",
		"{": "}",
		"[": "]",
		"\"": "\""
	})
	set_auto_brace_completion_enabled(true)
	
	var highlighter = CodeHighlighter.new()
	
	# Classes and structure
	var keywords_estructura = [
		"clase", "extiende", "prop", "fijar", "esta", "super", 
		"nuevo", "devolver", "importar", "exportar", "desde", "js"
	]
	for word in keywords_estructura:
		highlighter.add_keyword_color(word, Color("#ff8c00")) # DarkOrange
		
	# flow control
	var keywords_control = [
		"si", "sino", "ademas", "para", "en", "pasar", "salir"
	]
	for word in keywords_control:
		highlighter.add_keyword_color(word, Color("#ff7eb6")) # Pink :>
		
	# functions and vars
	var keywords_vars = [
		"var", "es", "funcion", "tipo", "@asincrono"
	]
	for word in keywords_vars:
		highlighter.add_keyword_color(word, Color("#66d9ef")) # i like cyan for this
		
	# Logic operators
	var keywords_operadores = [
		"mayor", "menor", "mayor_igual", "menor_igual", "no", 
		"igual_tipado", "igual", "y", "o", "mas", "menos", 
		"por", "entre", "resto", "exp"
	]
	for word in keywords_operadores:
		highlighter.add_keyword_color(word, Color("#f92672")) # Reddish
		
	# primitive types
	var keywords_literals = ["verdadero", "falso", "indefinido"]
	for word in keywords_literals:
		highlighter.add_keyword_color(word, Color("#ae81ff")) # Purple
		
	# strings and comments
	highlighter.number_color = Color("#f8f8f2") # numbers
	highlighter.symbol_color = Color("#f8f8f2") # keys, dots, etc
	highlighter.add_color_region('"', '"', Color("#e6db74")) # strings are yellow
	
	# comments
	highlighter.add_color_region("//", "", Color("#75715e"), false)
	highlighter.add_color_region("/*", "*/", Color("#75715e"), false)
	
	# methods
	highlighter.add_color_region(".", "(", Color("#a6e22e"))
	highlighter.symbol_color = Color("#f8f8f2")
	highlighter.member_variable_color = Color("#a6e22e")
	self.syntax_highlighter = highlighter
