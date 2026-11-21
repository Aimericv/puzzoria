#!/usr/bin/env bash
set -euo pipefail

[[ -d test-results ]] || exit 0
mkdir -p .ci-results
file_list="$(mktemp)"
partial=.ci-results/playwright-traces.cms.partial
trap 'rm -f -- "$file_list" "$partial"' EXIT
(cd test-results && find . -type f -name trace.zip -print0 | sort -z) > "$file_list"
[[ -s "$file_list" ]] || exit 0

# Four jobs can upload at most 256 MiB combined and retain it for one day.
# Export entire Playwright ZIPs only. Keep browser state encrypted in transit and at rest.
bytes=0
while IFS= read -r -d '' trace; do
  bytes=$((bytes + $(stat -c '%s' -- "test-results/$trace") + 4096))
done < "$file_list"
if (( bytes + 1048576 > 64 * 1024 * 1024 )); then
  echo 'The complete traces exceed the protected 64 MiB artifact bound.' >&2
  exit 1
fi
tar -C test-results --null --verbatim-files-from -T "$file_list" -cf - |
  openssl cms -encrypt -binary -aes-256-gcm -outform DER \
    -recip .github/ci51-traces-recipient.crt -keyopt rsa_padding_mode:oaep -keyopt rsa_oaep_md:sha256 -out "$partial"
[[ -s "$partial" ]]
mv -- "$partial" .ci-results/playwright-traces.cms
