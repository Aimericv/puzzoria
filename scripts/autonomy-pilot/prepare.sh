#!/usr/bin/env bash
set -euo pipefail
# All paths and the user are fixed; no project-provided shell is executed with credentials.
test "$(uname -s)" = Linux
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
