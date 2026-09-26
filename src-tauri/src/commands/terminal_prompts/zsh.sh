# Prompt for the IDE's terminal, loaded through ZDOTDIR (see terminal.rs).
#
#   ╭─ user › ~WorkFlows~ › project › branch
#   ╰─>
#
# Inputs: DISCHORD_WORKFLOWS (folder holding the projects, shown as `~WorkFlows~`) and
# DISCHORD_ROUNDED (set when the rounded ends of the branch chip can be drawn).

# This file replaces the user's .zshrc for this session: put ZDOTDIR back and load their
# own configuration first, so aliases, PATH and so on keep working.
export ZDOTDIR="${DISCHORD_ORIG_ZDOTDIR:-$HOME}"
[ -f "$ZDOTDIR/.zshrc" ] && source "$ZDOTDIR/.zshrc"

# Lets ${...} inside PROMPT be re-read on every redraw.
setopt PROMPT_SUBST


# COLORS
# 24-bit colors. %{ %} tell zsh the sequence takes no space on screen.
_dc_dim=$'%{\e[38;2;92;99;112m%}'
_dc_root=$'%{\e[38;2;198;120;221m%}'
_dc_seg=$'%{\e[38;2;86;182;194m%}'
_dc_last=$'%{\e[1;38;2;255;255;255m%}'
_dc_user=$'%{\e[1;38;2;137;146;245m%}'
_dc_arrow=$'%{\e[38;2;137;146;245m%}'
_dc_branch=$'%{\e[38;2;137;146;245;48;2;42;47;58m%}'
_dc_chipfg=$'%{\e[38;2;42;47;58m%}'
_dc_rst=$'%{\e[0m%}'


# PATH AND BRANCH
# Fills _dischord_path with everything that comes after the user name.
_dischord_update() {
    local p="$PWD"
    local root="${DISCHORD_WORKFLOWS%/}"
    local label rest

    # The path is shown in full. Its start is a label: the projects folder, home, or "/".
    if [[ -n "$root" && ( "$p" == "$root" || "$p" == "$root"/* ) ]]; then
        label="~WorkFlows~"
        rest="${p#$root}"
    elif [[ "$p" == "$HOME" || "$p" == "$HOME"/* ]]; then
        label="~"
        rest="${p#$HOME}"
    else
        label="/"
        rest="$p"
    fi
    rest="${rest#/}"

    local sep=" ${_dc_dim}›${_dc_rst} "
    local out="${_dc_root}${label}${_dc_rst}"

    # One segment per folder; the current (last) one stands out. `%` is doubled so a folder
    # name containing it is not read as a prompt escape.
    if [[ -n "$rest" ]]; then
        local -a parts
        parts=("${(@s:/:)rest}")
        local n=${#parts} i seg

        for (( i = 1; i <= n; i++ )); do
            seg="${parts[i]//\%/%%}"

            if (( i > 1 )) || [[ "$label" != "/" ]]; then
                out+="$sep"
            else
                out+=" "
            fi

            if (( i == n )); then
                out+="${_dc_last}${seg}${_dc_rst}"
            else
                out+="${_dc_seg}${seg}${_dc_rst}"
            fi
        done
    fi

    # Git branch, only inside a repository.
    local branch
    branch="$(git symbolic-ref --short -q HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)"
    if [[ -n "$branch" ]]; then
        if [[ -n "$DISCHORD_ROUNDED" ]]; then
            out+="${sep}${_dc_chipfg}@CAP_L@${_dc_branch}${branch//\%/%%}${_dc_rst}${_dc_chipfg}@CAP_R@${_dc_rst}"
        else
            out+="${sep}${_dc_branch} ${branch//\%/%%} ${_dc_rst}"
        fi
    fi

    _dischord_path=" ${_dc_dim}›${_dc_rst} ${out}"
}


# THE PROMPT
# Redrawn from a precmd hook so it wins over any prompt framework (powerlevel10k and
# friends) that also sets PROMPT before each line.
_dischord_prompt() {
    _dischord_update
    PROMPT=$'${_dc_dim}╭─${_dc_rst} ${_dc_user}%n${_dc_rst}${_dischord_path}\n${_dc_dim}╰─${_dc_arrow}>${_dc_rst} '
    RPROMPT=''
}
precmd_functions+=(_dischord_prompt)
