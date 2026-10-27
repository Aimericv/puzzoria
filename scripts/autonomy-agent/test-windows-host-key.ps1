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

foreach ($name in @('Set-BootstrapReady','Assert-Native')) {
  $node = $ast.Find({ param($item) $item -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq $name }, $true)
  if (-not $node) { throw "Missing function $name" }
  Invoke-Expression $node.Extent.Text
}
$script:readyState = @{generation=8;memory=@{STATE='keep'};pendingMessages=@(@{text='/pause';id=9});growth=@{lastDeployedCommit=$null;productionBootstrapApproval=@{sha=('1'*40);policyHash=('a'*64);validationRunId='123'};pendingDeployment=@{mergeSha=('1'*40);ownerApprovedBootstrap=$true;status='awaiting_policy_refresh'}}}
$template = $script:readyState | ConvertTo-Json -Depth 100
$script:readyPayload = $null
$script:readyExit = 0
function Read-GitHubJson {
  return @{sha='exact-old-blob';content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($script:readyState | ConvertTo-Json -Depth 100)))}
}
function gh {
  if ($args[0] -ne 'api' -or $args[1] -ne '--method' -or $args[2] -ne 'PUT' -or $args[3] -ne 'repos/Aimericv/puzzoria/contents/agent/autonomy/state.json' -or $args[4] -ne '--input') { throw 'Unexpected write outside the bounded state confirmation.' }
  $script:readyPayload = Get-Content -Raw -LiteralPath $args[5] | ConvertFrom-Json
  $global:LASTEXITCODE = $script:readyExit
}
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('puzzoria-ready-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $temporary | Out-Null
try {
  Set-BootstrapReady 'Aimericv/puzzoria' ('1'*40) ('a'*64) '123' $temporary
  $saved = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($script:readyPayload.content)) | ConvertFrom-Json
  if ($script:readyPayload.sha -ne 'exact-old-blob' -or $script:readyPayload.branch -ne 'codex/agent-state' -or $saved.generation -ne 9 -or $saved.growth.pendingDeployment.status -ne 'awaiting_activation' -or $saved.memory.STATE -ne 'keep' -or $saved.pendingMessages[0].text -ne '/pause') { throw 'State confirmation must preserve memory, directives and exact old blob CAS.' }
  $readyPassed = 1
  foreach ($kind in @('changed-head','changed-policy','already-deployed','concurrent-write')) {
    $script:readyState = $template | ConvertFrom-Json
    $script:readyExit = 0
    switch ($kind) {
      'changed-head' { $script:readyState.growth.pendingDeployment.mergeSha = '2'*40 }
      'changed-policy' { $script:readyState.growth.productionBootstrapApproval.policyHash = 'b'*64 }
      'already-deployed' { $script:readyState.growth.lastDeployedCommit = '3'*40 }
      'concurrent-write' { $script:readyExit = 409 }
    }
    Assert-Rejected { Set-BootstrapReady 'Aimericv/puzzoria' ('1'*40) ('a'*64) '123' $temporary }
    $readyPassed++
  }
  $script:readyState = $template | ConvertFrom-Json
  $script:readyState.growth.pendingDeployment.status = 'awaiting_activation'
  $script:readyPayload = $null
  Set-BootstrapReady 'Aimericv/puzzoria' ('1'*40) ('a'*64) '123' $temporary
  if ($null -ne $script:readyPayload) { throw 'Already confirmed state must not be rewritten.' }
  $readyPassed++
  $readyReport = @{passed=$readyPassed;failed=0;exactBlobCompareAndSwap=$true;memoryAndOwnerMessagesPreserved=$true;productionContacted=$false}
  [IO.File]::WriteAllText((Join-Path (Get-Location) '.ci-results/bootstrap-ready.json'), ($readyReport | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  $readyReport | ConvertTo-Json
} finally { Remove-Item -LiteralPath $temporary -Recurse -Force }
$global:LASTEXITCODE = 0
