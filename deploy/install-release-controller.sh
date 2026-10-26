#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ "${1:-}" != --apply ]]; then
  cat <<'HELP'
Prepared only: no production activation or host change.
After explicit owner approval, from the verified controller artifact directory:
  sudo bash install-release-controller.sh --apply CONFIG_JSON PUBLIC_DEPLOY_KEY
Use an existing Compose project, a separate ed25519 deploy key and an exact
bootstrapApprovedCommit. The private key never belongs in this directory.
Node is extracted from the existing pinned runtime image, not installed globally.
The deploy user has one forced command and never joins the Docker group.
HELP
  exit 0
fi
[[ "$(id -u)" == 0 && $# == 3 ]] || { echo 'Use root and provide configuration plus public deployment key.' >&2; exit 1; }
[[ ! -e /etc/puzzoria-release/config.json && ! -e /var/lib/puzzoria-release/state.json ]] || { echo 'Existing controller must be reviewed and upgraded explicitly; refusing overwrite.' >&2; exit 1; }
config_path="$(realpath "$2")"
public_key="$(realpath "$3")"
package_dir="$(dirname "$(realpath "$0")")"
[[ -f "$package_dir/release-host.mjs" && -d "$package_dir/node_modules/typescript" ]] || { echo 'Use the reviewed controller artifact, not an incomplete source directory.' >&2; exit 1; }
ssh-keygen -l -f "$public_key" >/dev/null
deploy_fingerprint="$(ssh-keygen -l -E sha256 -f "$public_key" | awk '{print $2}')"
if [[ -f /root/.ssh/authorized_keys ]] && ssh-keygen -l -E sha256 -f /root/.ssh/authorized_keys 2>/dev/null | awk '{print $2}' | grep -Fxq "$deploy_fingerprint"; then
  echo 'Use a separate deployment key, never the existing administrative root key.' >&2
  exit 1
fi
runtime_image='node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d'
bootstrap_dir="$(mktemp -d /tmp/puzzoria-controller-install.XXXXXX)"
container_id=''
cleanup() { [[ -z "$container_id" ]] || docker --host=unix:///var/run/docker.sock rm "$container_id" >/dev/null 2>&1 || true; rm -rf "$bootstrap_dir"; }
trap cleanup EXIT
container_id="$(docker --host=unix:///var/run/docker.sock create "$runtime_image")"
docker --host=unix:///var/run/docker.sock cp "$container_id:/usr/local/bin/node" "$bootstrap_dir/node"
docker --host=unix:///var/run/docker.sock cp "$container_id:/usr/local/LICENSE" "$bootstrap_dir/node-LICENSE"
"$bootstrap_dir/node" --input-type=module - "$config_path" "$package_dir" <<'JS'
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {validateHostConfig,hostDriver}=await import(pathToFileURL(process.argv[3]+'/release-host.mjs'));
const c=validateHostConfig(JSON.parse(readFileSync(process.argv[2],'utf8')));
const validation=JSON.parse(readFileSync(process.argv[3]+'/VALIDATION.json','utf8'));if(c.policyHash!==validation.policyHash)throw Error('Configuration does not match the reviewed controller policy');
if(c.initialCommit!=='0'.repeat(40))throw Error('This initial installer expects an explicitly approved bootstrap for the legacy image');
await hostDriver(c).currentImage();await hostDriver(c).schema();
JS
install -d -m 0755 /usr/local/lib/puzzoria-release
install -d -m 0700 /etc/puzzoria-release /var/lib/puzzoria-release
install -m 0600 "$config_path" /etc/puzzoria-release/config.json
install -m 0755 "$bootstrap_dir/node" /usr/local/lib/puzzoria-release/node
install -m 0644 "$bootstrap_dir/node-LICENSE" /usr/local/lib/puzzoria-release/node-LICENSE
for file in release-host.mjs deployment-transaction.mjs release-policy.mjs public-probe.mjs; do install -m 0644 "$package_dir/$file" "/usr/local/lib/puzzoria-release/$file"; done
cp -a "$package_dir/node_modules" /usr/local/lib/puzzoria-release/
chown -R root:root /usr/local/lib/puzzoria-release
chmod -R go-w /usr/local/lib/puzzoria-release
install -m 0755 "$package_dir/puzzoria-release-entry.sh" /usr/local/bin/puzzoria-release-entry
/usr/local/lib/puzzoria-release/node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {hostDriver,durableStore} from '/usr/local/lib/puzzoria-release/release-host.mjs';
const c=JSON.parse(readFileSync('/etc/puzzoria-release/config.json','utf8'));
execFileSync('git',['init','--bare',c.repository],{stdio:'ignore'});
const image=await hostDriver(c).currentImage();
await durableStore(c.stateDirectory).write({phase:'healthy',currentCommit:'0'.repeat(40),currentImage:image,legacyBaselineUnknown:true,initializedAt:new Date().toISOString()});
JS
if ! id puzzoria-release >/dev/null 2>&1; then useradd --create-home --shell /bin/sh puzzoria-release; fi
install -d -o puzzoria-release -g puzzoria-release -m 0700 /home/puzzoria-release/.ssh
/usr/local/lib/puzzoria-release/node --input-type=module - "$public_key" <<'JS'
import {readFileSync,writeFileSync,chownSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const key=readFileSync(process.argv[2],'utf8').trim();if(!/^ssh-ed25519 [A-Za-z0-9+/=]+(?: [^\r\n]+)?$/.test(key))throw Error('Use one separate ed25519 public key');
const path='/home/puzzoria-release/.ssh/authorized_keys';writeFileSync(path,'restrict,command="/usr/local/bin/puzzoria-release-entry" '+key+'\n',{mode:0o600});chownSync(path,Number(execFileSync('id',['-u','puzzoria-release'])),Number(execFileSync('id',['-g','puzzoria-release'])));
JS
printf '%s\n' 'puzzoria-release ALL=(root) NOPASSWD: /usr/bin/flock --nonblock --conflict-exit-code 75 /run/lock/puzzoria-release.lock /usr/local/lib/puzzoria-release/node /usr/local/lib/puzzoria-release/release-host.mjs release *' > /etc/sudoers.d/puzzoria-release
chmod 0440 /etc/sudoers.d/puzzoria-release
visudo -cf /etc/sudoers.d/puzzoria-release
install -m 0644 "$package_dir/puzzoria-release-recover.service" "$package_dir/puzzoria-release-recover.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now puzzoria-release-recover.timer
echo 'Restricted controller installed; existing application unchanged. First rollout still requires exact source approval and GitHub production gates.'
