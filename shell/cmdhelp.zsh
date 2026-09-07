# Source after history plugins. All model output is data, never shell code.
_cmdhelp_root=${${(%):-%x}:A:h:h}
cmdhelp() { command "$_cmdhelp_root/bin/cmdhelp" --shell zsh "$@"; }
_cmdhelp_widget() {
  local saved_buffer=$BUFFER saved_cursor=$CURSOR task_dir selected
  task_dir=$(mktemp -d "${TMPDIR:-/tmp}/cmdhelp.XXXXXXXX") || return
  {
    print -rn -- "$saved_buffer" > "$task_dir/input"
    zle -I
    # Bun on macOS does not receive stdin events through /dev/tty.
    # Zsh's TTY names the concrete device (e.g. /dev/ttys001).
    if cmdhelp ui --mode "$1" --buffer-file "$task_dir/input" --output-file "$task_dir/result" < "$TTY" > "$TTY"; then
      if [[ -s "$task_dir/result" ]]; then
        selected=$(<"$task_dir/result")
        BUFFER=$selected
        CURSOR=${#BUFFER}
      else
        BUFFER=$saved_buffer
        CURSOR=$saved_cursor
      fi
    else
      BUFFER=$saved_buffer
      CURSOR=$saved_cursor
    fi
  } always {
    command rm -rf -- "$task_dir"
    zle reset-prompt
  }
}
_cmdhelp_suggest() { _cmdhelp_widget suggest; }
_cmdhelp_explain() { _cmdhelp_widget explain; }
zle -N _cmdhelp_suggest
zle -N _cmdhelp_explain
bindkey '^X^G' _cmdhelp_suggest
bindkey '^X^E' _cmdhelp_explain
