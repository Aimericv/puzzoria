#!/usr/bin/env bash
set -euo pipefail
# Run before exposing Plus/vault credentials. Reuse the verified pilot sandbox.
bash scripts/autonomy-pilot/prepare.sh
npm ci --ignore-scripts --no-audit --no-fund
sudo mkdir -p /opt/puzzoria-agent-deps
sudo cp -a node_modules /opt/puzzoria-agent-deps/
sudo python3 - <<'PY'
from pathlib import Path
path=Path('/etc/codex/requirements.toml')
text=path.read_text()
anchor='"/opt/puzzoria-pilot/work" = "write"'
if text.count(anchor)!=1:raise RuntimeError('Unexpected managed policy')
path.write_text(text.replace(anchor,anchor+'\n"/opt/puzzoria-agent-deps" = "read"'))
PY
