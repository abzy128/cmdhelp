#!/bin/zsh
set -eu
zmodload zsh/zpty
zmodload zsh/zselect

root=${0:A:h:h}
fixture=$(mktemp -d)
export XDG_CONFIG_HOME=$fixture CMDHELP_PI_PROFILE=$fixture
export CMDHELP_PROVIDER=cmdhelp-test-invalid CMDHELP_MODEL=cmdhelp-test-invalid
export TERM=xterm-256color

# Exercise real ZLE and Bun input, without credentials or model requests.
expect_output() {
  local expected=$1 chunk transcript='' attempt
  for attempt in {1..500}; do
    while zpty -r cmdhelp_test chunk; do
      transcript+=$chunk
      [[ $transcript == *"$expected"* ]] && return 0
    done
    zselect -t 1 || true
  done
  print -ru2 -- "Timed out waiting for: $expected"
  print -ru2 -- "$transcript"
  return 1
}

{
  zpty -b cmdhelp_test zsh -f
  zpty -w cmdhelp_test "PS1='CMDHELP_READY> '; source ${(q)root}/shell/cmdhelp.zsh"
  expect_output 'CMDHELP_READY> '
  zpty -w -n cmdhelp_test $'\x18\x07'
  expect_output 'Enter: send'
  zpty -w -n cmdhelp_test 'keyboard-probe'
  expect_output '> keyboard-probe'
  zpty -w -n cmdhelp_test $'\r'
  expect_output 'Tab: follow-up'
  zpty -w -n cmdhelp_test $'\t'
  expect_output 'Enter: send'
  zpty -w -n cmdhelp_test 'followup-probe'
  expect_output '> followup-probe'
  zpty -w -n cmdhelp_test $'\e'
  expect_output 'CMDHELP_READY> '
  # Explain auto-submits the existing buffer, then accepts Tab and Escape.
  zpty -w -n cmdhelp_test $'echo preserved\x18\x05'
  expect_output 'Tab: follow-up'
  zpty -w -n cmdhelp_test $'\t'
  expect_output 'Enter: send'
  zpty -w -n cmdhelp_test 'explain-probe'
  expect_output '> explain-probe'
  zpty -w -n cmdhelp_test $'\e'
  expect_output 'echo preserved'
  zpty -w -n cmdhelp_test $'\x15exit\r'
  print 'Interactive checks passed: text, Enter, Tab, Escape, and buffer restoration in both widgets.'
} always {
  zpty -d cmdhelp_test 2>/dev/null || true
  command rm -rf -- "$fixture"
}
