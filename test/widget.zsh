#!/bin/zsh
set -eu
zle() { :; }
bindkey() { :; }
source "${0:A:h:h}/shell/cmdhelp.zsh"
function cmdhelp() {
  local outfile=${@[-1]}
  case $scenario in
    cancel) return 0 ;;
    fail) return 1 ;;
    insert) print -rn -- 'echo "$(touch /tmp/cmdhelp-must-not-execute)"' > "$outfile" ;;
  esac
}
for scenario in cancel fail insert; do
  BUFFER='original command'
  CURSOR=4
  _cmdhelp_widget suggest
  if [[ $scenario == insert ]]; then
    [[ $BUFFER == 'echo "$(touch /tmp/cmdhelp-must-not-execute)"' ]]
    [[ $CURSOR == ${#BUFFER} ]]
    [[ ! -e /tmp/cmdhelp-must-not-execute ]]
  else
    [[ $BUFFER == 'original command' && $CURSOR == 4 ]]
  fi
done
print 'Widget checks passed: cancel, failure, literal insertion, cursor restoration.'
