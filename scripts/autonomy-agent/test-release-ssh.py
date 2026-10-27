"""Real loopback SSH test on a disposable GitHub runner; never run on the VPS."""
import json
import os
import pathlib
import pwd
import shutil
import socket
import subprocess
import tempfile
import time

if os.geteuid() != 0 or os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('GITHUB_REPOSITORY') != 'Aimericv/puzzoria':
    raise SystemExit('Use only the disposable GitHub validation runner as root.')
if pathlib.Path('/etc/puzzoria-release/config.json').exists():
    raise SystemExit('Refusing to run on an installed controller.')
try:
    pwd.getpwnam('puzzoria-release')
except KeyError:
    pass
else:
    raise SystemExit('Refusing to reuse an existing deployment account.')


def call(args, *, check=True, timeout=15):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError('Fixture operation failed: ' + args[0] + ', code ' + str(result.returncode))
    return result


folder = pathlib.Path(tempfile.mkdtemp(prefix='puzzoria-ssh-fixture-'))
folder.chmod(0o755)
created_user = False
server = None
root_authorized = pathlib.Path('/root/.ssh') / ('puzzoria-fixture-' + folder.name)
try:
    call(['useradd', '--create-home', '--shell', '/bin/sh', 'puzzoria-release'])
    created_user = True
    user = pwd.getpwnam('puzzoria-release')
    home = pathlib.Path(user.pw_dir)
    ssh_dir = home / '.ssh'
    ssh_dir.mkdir(mode=0o700)
    os.chown(ssh_dir, user.pw_uid, user.pw_gid)
    for name in ('host', 'client'):
        call(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(folder / name)])
    public_key = (folder / 'client.pub').read_text()
    authorized = ssh_dir / 'authorized_keys'
    authorized.write_text(public_key)
    authorized.chmod(0o600)
    os.chown(authorized, user.pw_uid, user.pw_gid)
    # The same real key is also authorized for root, so the root rejection is meaningful.
    root_authorized.parent.mkdir(mode=0o700, exist_ok=True)
    root_authorized.write_text(public_key)
    root_authorized.chmod(0o600)
    fake_sudo = folder / 'sudo-fixture'
    fake_sudo.write_text('#!/bin/sh\nprintf "%s\\n" "$*"\n')
    fake_sudo.chmod(0o755)
    entry = folder / 'entry'
    entry.write_text(pathlib.Path('deploy/puzzoria-release-entry.sh').read_text().replace('/usr/bin/sudo', str(fake_sudo)))
    entry.chmod(0o755)
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    config_text = pathlib.Path('deploy/puzzoria-release-sshd.conf').read_text()
    for before, after in {
        'Port 2222': 'Port ' + str(port),
        'ListenAddress 0.0.0.0': 'ListenAddress 127.0.0.1',
        'HostKey /etc/ssh/ssh_host_ed25519_key': 'HostKey ' + str(folder / 'host'),
        'PidFile /run/puzzoria-release-sshd.pid': 'PidFile ' + str(folder / 'pid'),
        'ForceCommand /usr/local/bin/puzzoria-release-entry': 'ForceCommand ' + str(entry),
    }.items():
        if before not in config_text:
            raise RuntimeError('Unexpected production SSH policy')
        config_text = config_text.replace(before, after)
    config_text += '\nMatch User root\n  AuthorizedKeysFile ' + str(root_authorized) + '\n'
    config = folder / 'sshd.conf'
    config.write_text(config_text)
    pathlib.Path('/run/sshd').mkdir(exist_ok=True, mode=0o755)
    call(['/usr/sbin/sshd', '-t', '-f', str(config)])
    effective = call(['/usr/sbin/sshd', '-T', '-f', str(config), '-C', 'user=puzzoria-release,host=localhost,addr=127.0.0.1']).stdout
    for setting in ('permitrootlogin no', 'passwordauthentication no', 'kbdinteractiveauthentication no', 'authenticationmethods publickey', 'allowusers puzzoria-release', 'permittty no', 'disableforwarding yes', 'permituserenvironment no', 'permituserrc no', 'strictmodes yes'):
        if setting not in effective.splitlines():
            raise RuntimeError('Unsafe effective SSH setting: ' + setting)
    host_public = (folder / 'host.pub').read_text().split()
    known = folder / 'known_hosts'
    known.write_text('[127.0.0.1]:' + str(port) + ' ' + host_public[0] + ' ' + host_public[1] + '\n')
    log = (folder / 'sshd.log').open('w')
    server = subprocess.Popen(['/usr/sbin/sshd', '-D', '-e', '-f', str(config)], stdout=log, stderr=log)
    for attempt in range(30):
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.1)
    else:
        raise RuntimeError('Loopback SSH fixture did not start')
    options = ['ssh', '-i', str(folder / 'client'), '-p', str(port), '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + str(known), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5']
    check = call(options + ['puzzoria-release@127.0.0.1', 'check'])
    if not check.stdout.strip().endswith('release-host.mjs check'):
        raise RuntimeError('Read-only check did not reach the bounded entry point')
    release = 'release ' + 'a' * 40 + ' ' + 'b' * 40 + ' ' + 'c' * 64
    if not call(options + ['puzzoria-release@127.0.0.1', release]).stdout.strip().endswith('release-host.mjs ' + release):
        raise RuntimeError('A bounded release did not reach the expected entry point')
    marker = folder / 'must-not-exist'
    rejected = ['id', 'touch ' + str(marker), 'check; touch ' + str(marker), release + '; touch ' + str(marker), 'scp -t /tmp', 'release invalid', 'check extra']
    for command in rejected:
        if call(options + ['puzzoria-release@127.0.0.1', command], check=False).returncode == 0:
            raise RuntimeError('An unbounded command was accepted')
    if marker.exists():
        raise RuntimeError('A forbidden command ran')
    if call(options + ['root@127.0.0.1', 'check'], check=False).returncode == 0:
        raise RuntimeError('Root authenticated on the deployment listener')
    forwarding = call(options + ['-o', 'ExitOnForwardFailure=yes', '-N', '-R', '127.0.0.1:0:127.0.0.1:22', 'puzzoria-release@127.0.0.1'], check=False)
    if forwarding.returncode == 0 or 'forward' not in forwarding.stderr.lower():
        raise RuntimeError('Remote forwarding was not rejected')
    proof = {'status': 'passed', 'realSshAuthentication': True, 'rootWithSameKeyRejected': True, 'passwordAndInteractiveAuthDisabled': True, 'readOnlyCheckAllowed': True, 'boundedReleaseAllowed': True, 'arbitraryCommandsRejected': len(rejected), 'forbiddenMarkerAbsent': True, 'forwardingRejected': True, 'productionContacted': False, 'listener': 'loopback-only'}
    pathlib.Path('.ci-results').mkdir(exist_ok=True)
    pathlib.Path('.ci-results/restricted-ssh.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof))
finally:
    if server is not None:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
    root_authorized.unlink(missing_ok=True)
    if created_user:
        call(['userdel', '--remove', 'puzzoria-release'], check=False)
    shutil.rmtree(folder)
