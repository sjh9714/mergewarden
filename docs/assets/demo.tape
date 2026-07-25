# Recording for docs/assets/mergewarden-demo.gif
#
# Records a real `npx` execution of the published package — no simulated output
# and no local build. Re-record with:
#
#   vhs docs/assets/demo.tape
#
# Requires vhs and ttyd (brew install vhs ttyd). Keep the command typed here
# identical to the one in the README's "Try It in 60 Seconds" block.
#
# The full report is 95 lines, so it scrolls past the top of an ordinary
# terminal. That is what the GIF shows. For the still frame used at the top of
# the README, see demo-head.tape, which bounds the same real command with
# `head` so the framing — command, narration, decision, first findings — stays
# on screen.

Output docs/assets/mergewarden-demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 1180
Set Height 860
Set Padding 18
Set Theme "Builtin Dark"
Set TypingSpeed 45ms
Set PlaybackSpeed 1.0

# The npx cache is warmed off-camera so the recording shows how long the scan
# takes, not how long npm takes to download it. The run below is real.
Hide
Type "cd $(mktemp -d) && npx --yes mergewarden --version >/dev/null 2>&1 && clear"
Enter
Sleep 15s
Show

Sleep 800ms
Type "npx --yes mergewarden demo"
Sleep 600ms
Enter
Sleep 4s
