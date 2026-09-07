"""Exercise real PSReadLine and Bun terminal input on Unix, without model requests."""
import fcntl
import os
from pathlib import Path
import pty
import select
import signal
import struct
import tempfile
import termios
import time

root = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='cmdhelp-pty-') as fixture:
    pid, fd = pty.fork()
    if pid == 0:
        os.environ.update(
            TERM='xterm-256color', XDG_CONFIG_HOME=fixture,
            CMDHELP_PI_PROFILE=fixture, CMDHELP_PROVIDER='cmdhelp-test-invalid',
            CMDHELP_MODEL='cmdhelp-test-invalid',
        )
        script = str(root / 'shell/cmdhelp.ps1').replace("'", "''")
        os.execvp('pwsh', ['pwsh', '-NoLogo', '-NoProfile', '-NoExit', '-Command',
                          "function prompt { 'CMDHELP_READY> ' }; . '" + script + "'"])
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 30, 120, 0, 0))

    def read():
        data = os.read(fd, 65536)
        # PowerShell queries the cursor position when entering/repainting PSReadLine.
        if b'\x1b[6n' in data:
            os.write(fd, b'\x1b[1;1R')
        return data

    def expect(needle):
        output = bytearray()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if select.select([fd], [], [], 0.1)[0]:
                output.extend(read())
                if needle.encode() in output:
                    return
        raise AssertionError(f'Timed out waiting for {needle!r}: {bytes(output)!r}')

    def send(data):
        # Allow prompt initialization/input draining to finish before the next key.
        deadline = time.monotonic() + 0.2
        while time.monotonic() < deadline:
            if select.select([fd], [], [], 0.05)[0]:
                read()
        os.write(fd, data)

    try:
        expect('CMDHELP_READY> ')
        send(b'\x18\x07')
        expect('Enter: send')
        send(b'keyboard-probe')
        expect('keyboard-probe')
        send(b'\r')
        expect('Tab: follow-up')
        send(b'\t')
        expect('Enter: send')
        send(b'\x1b')
        expect('CMDHELP_READY> ')
        send(b'Write-Output preserved\x18\x05')
        expect('Tab: follow-up')
        send(b'\x1b')
        expect('preserved')
        send(b'\x18\x07')
        expect('Enter: send')
        send(b'\x03')
        expect('preserved')
        print('PowerShell terminal checks passed: typing, Enter, Tab, Escape, Ctrl-C, both shortcuts, and buffer restoration.')
    finally:
        os.killpg(pid, signal.SIGTERM)
        os.close(fd)
        os.waitpid(pid, 0)
