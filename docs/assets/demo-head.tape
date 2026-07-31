# Still frame for the top of the README: docs/assets/mergewarden-demo-head.png
#
#   vhs docs/assets/demo-head.tape
#
# The full `demo` report is 95 lines and scrolls past the top of a terminal, so
# the framing a first-time reader needs — the command, what is being scanned,
# the decision, and the first findings — is exactly the part that disappears.
# Bounding the same real command with `head` keeps it on screen.
#
# This is a real execution of the published package. Nothing is simulated, and
# the `head` bound is visible in the recorded command rather than hidden.

# vhs always writes a GIF; only the Screenshot below is used, so the animation
# goes to a scratch path rather than into the repository.
Output "/tmp/mergewarden-demo-head.gif"

Set Shell "bash"
Set FontSize 15
Set Width 1180
Set Height 745
Set Padding 18
Set Theme "Builtin Dark"
Set TypingSpeed 45ms

Hide
Type "cd $(mktemp -d) && npx --yes mergewarden --version >/dev/null 2>&1 && clear"
Enter
Sleep 15s
Show

Sleep 800ms
Type "npx --yes mergewarden demo | head -35"
Sleep 600ms
Enter
Sleep 4s

Screenshot docs/assets/mergewarden-demo-head.png

Sleep 1s
