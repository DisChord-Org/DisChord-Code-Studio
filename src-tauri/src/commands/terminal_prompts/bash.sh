# Prompt for the IDE's terminal, loaded with `bash --rcfile` (see terminal.rs).
#
#   ╭─ user › ~WorkFlows~ › project › branch
#   ╰─>
#
# Inputs: DISCHORD_WORKFLOWS (folder holding the projects, shown as `~WorkFlows~`) and
# DISCHORD_ROUNDED (set when the rounded ends of the branch chip can be drawn).

# The user's own configuration first, so aliases, PATH and so on keep working.
[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"


# COLORS
# 24-bit colors. \001 and \002 tell readline the sequence takes no space on screen.
_dc_dim=$'\001\e[38;2;92;99;112m\002'
_dc_root=$'\001\e[38;2;198;120;221m\002'
_dc_seg=$'\001\e[38;2;86;182;194m\002'
_dc_last=$'\001\e[1;38;2;255;255;255m\002'
_dc_user=$'\001\e[1;38;2;137;146;245m\002'
_dc_arrow=$'\001\e[38;2;137;146;245m\002'
_dc_branch=$'\001\e[38;2;137;146;245;48;2;42;47;58m\002'
_dc_chipfg=$'\001\e[38;2;42;47;58m\002'
_dc_rst=$'\001\e[0m\002'

# PATH AND BRANCH
# Fills _dischord_path with everything that comes after the user name.
_dischord_update() {
    local p="$PWD"
    local root="${DISCHORD_WORKFLOWS%/}"
    local label rest

    # The path is shown in full. Its start is a label: the projects folder, home, or "/".
    if [ -n "$root" ] && { [ "$p" = "$root" ] || [ "${p#"$root"/}" != "$p" ]; }; then
        label="~WorkFlows~"
        rest="${p#"$root"}"
    elif [ "$p" = "$HOME" ] || [ "${p#"$HOME"/}" != "$p" ]; then
        label="~"
        rest="${p#"$HOME"}"
    else
        label="/"
        rest="$p"
    fi
    rest="${rest#/}"

    local sep=" ${_dc_dim}›${_dc_rst} "
    local out="${_dc_root}${label}${_dc_rst}"

    # One segment per folder; the current one stands out.
    if [ -n "$rest" ]; then
        local IFS=/ parts n i
        read -ra parts <<< "$rest"
        n=${#parts[@]}

        for ((i = 0; i < n; i++)); do
            if [ "$i" -gt 0 ] || [ "$label" != "/" ]; then
                out+="$sep"
            else
                out+=" "
            fi

            if [ "$i" -eq $((n - 1)) ]; then
                out+="${_dc_last}${parts[i]}${_dc_rst}"
            else
                out+="${_dc_seg}${parts[i]}${_dc_rst}"
            fi
        done
    fi

    # Git branch, only inside a repository.
    local branch
    branch="$(git symbolic-ref --short -q HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)"
    if [ -n "$branch" ]; then
        if [ -n "$DISCHORD_ROUNDED" ]; then
            out+="${sep}${_dc_chipfg}@CAP_L@${_dc_branch}${branch}${_dc_rst}${_dc_chipfg}@CAP_R@${_dc_rst}"
        else
            out+="${sep}${_dc_branch} ${branch} ${_dc_rst}"
        fi
    fi

    _dischord_path=" ${_dc_dim}›${_dc_rst} ${out}"
}


# THE PROMPT ITSELF
# \u and \n are expanded by bash when the prompt is drawn; ${_dischord_path} is left
# as text on purpose so it is read on every redraw.
_dischord_ps1() {
    _dischord_update
    PS1="${_dc_dim}╭─${_dc_rst} ${_dc_user}\u${_dc_rst}\${_dischord_path}\n${_dc_dim}╰─${_dc_arrow}>${_dc_rst} "
}

# Appended at the end so it runs after any prompt framework
# that rewrites PS1 on every redraw.
PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND;}_dischord_ps1"
