#!/usr/bin/env bash
set -euo pipefail
command="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$command" == check ]]; then
  exec /usr/bin/sudo -n /usr/bin/flock --nonblock --conflict-exit-code 75 /run/lock/puzzoria-release.lock \
    /usr/local/lib/puzzoria-release/node /usr/local/lib/puzzoria-release/release-host.mjs check
fi
[[ "$command" =~ ^release\ [a-f0-9]{40}\ [a-f0-9]{40}\ [a-f0-9]{64}$ ]] || exit 1
read -r verb sha expected policy <<<"$command"
exec /usr/bin/sudo -n /usr/bin/flock --nonblock --conflict-exit-code 75 /run/lock/puzzoria-release.lock \
  /usr/local/lib/puzzoria-release/node /usr/local/lib/puzzoria-release/release-host.mjs "$verb" "$sha" "$expected" "$policy"
