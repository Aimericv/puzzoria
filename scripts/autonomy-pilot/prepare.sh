#!/usr/bin/env bash
set -euo pipefail
# All paths and the user are fixed; no project-provided shell is executed with credentials.
test "$(uname -s)" = Linux
# Ubuntu 24.04 needs the distribution's Bubblewrap AppArmor exception to
# create the native sandbox. Keep the global user-namespace restriction on.
# https://learn.chatgpt.com/docs/sandboxing#prerequisites
sudo apt-get update -qq
sudo env DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends bubblewrap apparmor-profiles
sudo install -m 0644 /usr/share/apparmor/extra-profiles/bwrap-userns-restrict /etc/apparmor.d/bwrap-userns-restrict
sudo apparmor_parser -r /etc/apparmor.d/bwrap-userns-restrict
sudo useradd --uid 3050 --create-home --shell /bin/bash puzzoria-pilot
sudo mkdir -p /opt/puzzoria-pilot/{readonly,work,auth,private} /etc/codex
sudo chmod 700 /opt/puzzoria-pilot/private
sudo cp scripts/autonomy-pilot/*.mjs /opt/puzzoria-pilot/readonly/
sudo cp scripts/autonomy-pilot/requirements.toml /etc/codex/requirements.toml
sudo chmod 644 /etc/codex/requirements.toml
git archive HEAD | sudo tar -x -C /opt/puzzoria-pilot/work
sudo chown -R puzzoria-pilot:puzzoria-pilot /opt/puzzoria-pilot/{work,auth}
sudo chmod 700 /opt/puzzoria-pilot/auth
# Runtime installed before secret exposure; make the pinned CLI available to the restricted user.
sudo cp -a scripts/autonomy-pilot/runtime/node_modules /opt/puzzoria-pilot/readonly/node_modules
