$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'deploy/setup-release-from-windows.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Windows installer must parse.' }
$definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Read-VerifiedAdminHostKey' }, $true)
if (-not $definition) { throw 'Missing host key verifier.' }
Invoke-Expression $definition.Extent.Text
# Public fixture bytes only; this test never creates a private key or contacts a host.
$blob = [byte[]](0,0,0,11) + [Text.Encoding]::ASCII.GetBytes('ssh-ed25519') + [byte[]](0,0,0,32) + [byte[]](0..31)
$encoded = [Convert]::ToBase64String($blob)
$hash = [Security.Cryptography.SHA256]::Create()
try { $fingerprint = 'SHA256:' + [Convert]::ToBase64String($hash.ComputeHash($blob)).TrimEnd('=') } finally { $hash.Dispose() }
$script:mockLines = @("ssh-ed25519 $encoded public-fixture")
$script:mockExit = 0
$script:observed = @()
function ssh {
  $script:observed = @($args)
  $global:LASTEXITCODE = $script:mockExit
  return $script:mockLines
}
function Assert-Rejected([scriptblock]$Action) {
  $rejected = $false
  try { & $Action | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Unverified host key was accepted.' }
}
$passed = 0
foreach ($port in @(22,2223)) {
  $result = Read-VerifiedAdminHostKey 'local-admin-identity' $port $fingerprint
  if ($result -ne $encoded) { throw 'Verified public key not returned.' }
  foreach ($option in @('IdentitiesOnly=yes','StrictHostKeyChecking=yes','HostKeyAlias=37.27.24.173','PasswordAuthentication=no','KbdInteractiveAuthentication=no','ConnectTimeout=15')) {
    if ($script:observed -notcontains $option) { throw "Missing SSH protection: $option" }
  }
  if ($script:observed[0] -ne '-i' -or $script:observed[1] -ne 'local-admin-identity' -or $script:observed[2] -ne '-p' -or $script:observed[3] -ne "$port" -or $script:observed[-2] -ne 'root@37.27.24.173' -or $script:observed[-1] -ne 'cat /etc/ssh/ssh_host_ed25519_key.pub') { throw 'Only the public host key may be read from the fixed host.' }
  $passed++
}
Assert-Rejected { Read-VerifiedAdminHostKey 'local-admin-identity' 22 'SHA256:wrong' }; $passed++
$script:mockExit = 255
Assert-Rejected { Read-VerifiedAdminHostKey 'local-admin-identity' 22 $fingerprint }; $passed++
$script:mockExit = 0
foreach ($bad in @('',"ssh-rsa $encoded",'ssh-ed25519 not-valid-base64===')) {
  $script:mockLines = @($bad)
  Assert-Rejected { Read-VerifiedAdminHostKey 'local-admin-identity' 22 $fingerprint }; $passed++
}
$report = @{passed=$passed;failed=0;strictKnownHosts=$true;independentFingerprint=$true;publicKeyOnly=$true;sshKeyscanRequired=$false;productionContacted=$false}
New-Item -ItemType Directory -Force '.ci-results' | Out-Null
[IO.File]::WriteAllText((Join-Path (Get-Location) '.ci-results/windows-host-key.json'), ($report | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$report | ConvertTo-Json
