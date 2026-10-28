[CmdletBinding()]
param([switch]$Apply,[switch]$Activate,[string]$ApprovedCommit,[string]$PolicyHash,[string]$PackageRunId)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $Apply) { Write-Output 'Preparation uniquement : aucun acces VPS, publication ou activation.'; return }
if ($ApprovedCommit -notmatch '^[a-f0-9]{40}$' -or $PolicyHash -notmatch '^[a-f0-9]{64}$' -or $PackageRunId -notmatch '^\d+$') { throw 'Maintenance exacte revue requise.' }
function Assert-Command([string]$Operation) { if ($LASTEXITCODE -ne 0) { throw "Echec : $Operation." } }
function Read-Json([string]$Path) { $value = & gh api $Path; Assert-Command 'lecture GitHub'; return (($value -join "`n") | ConvertFrom-Json) }
$repo = 'Aimericv/puzzoria'
$stateFile = Read-Json "repos/$repo/contents/agent/autonomy/state.json?ref=codex%2Fagent-state"
$state = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($stateFile.content)) | ConvertFrom-Json
$approval = $state.growth.reviewedMaintenance
if ($approval.kind -ne 'reviewed-controller-maintenance' -or $approval.ownerAuthorized -ne $true -or -not $approval.approvedAt -or $approval.sha -ne $ApprovedCommit -or $approval.policyHash -ne $PolicyHash -or $approval.packageRunId -ne $PackageRunId -or $approval.status -notin @('awaiting_operator','deployed') -or $state.growth.lastDeployedCommit -notin @($approval.previousCommit,$ApprovedCommit)) { throw 'Accord exact de maintenance absent ou production plus recente.' }
$adminKey = Join-Path $env:USERPROFILE '.ssh\puzzoria_deploy'
$deployKey = Join-Path $env:USERPROFILE '.ssh\puzzoria_release_auto_ed25519'
foreach ($key in @($adminKey,$deployKey)) { if (-not (Test-Path -LiteralPath $key -PathType Leaf)) { throw 'Cle locale existante requise ; aucune regeneration.' } }
$directory = Join-Path ([IO.Path]::GetTempPath()) ('puzzoria-maintenance-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $directory | Out-Null
try {
  & gh run download $PackageRunId --repo $repo --name reviewed-puzzoria-maintenance --dir $directory
  Assert-Command 'telechargement du paquet revu'
  $archive = Join-Path $directory 'puzzoria-controller.tar.gz'
  $bundle = Join-Path $directory 'reviewed.bundle'
  if ((Get-FileHash -Algorithm SHA256 $archive).Hash.ToLowerInvariant() -ne $approval.controllerArchiveSha256 -or (Get-FileHash -Algorithm SHA256 $bundle).Hash.ToLowerInvariant() -ne $approval.bundleSha256) { throw 'Empreinte du paquet ou du bundle differente de la revue.' }
  & tar -xzf $archive -C $directory
  Assert-Command 'extraction du paquet'
  $manifest = Get-Content -Raw (Join-Path $directory 'VALIDATION.json') | ConvertFrom-Json
  if ($manifest.source -ne $approval.validatedSource -or $manifest.policyHash -ne $PolicyHash) { throw 'Source et politique du paquet differentes de la revue.' }
  $public = (& ssh -i $adminKey -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o ConnectTimeout=15 root@37.27.24.173 'cat /etc/ssh/ssh_host_ed25519_key.pub') -join ''
  Assert-Command 'lecture de la cle publique via SSH deja verifie'
  if ($public -notmatch '^ssh-ed25519\s+([A-Za-z0-9+/=]+)(?:\s|$)') { throw 'Cle publique ED25519 attendue.' }
  $pinned = $Matches[1]
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { $fingerprint = 'SHA256:' + [Convert]::ToBase64String($algorithm.ComputeHash([Convert]::FromBase64String($pinned))).TrimEnd('=') } finally { $algorithm.Dispose() }
  if ($fingerprint -ne 'SHA256:7wiefI6XYd5fbKwZfx9Dyvk2UNY2sqnHgMc7CD+oXeg') { throw 'Empreinte du VPS differente de celle approuvee.' }
  $known = Join-Path $directory 'known_hosts'
  [IO.File]::WriteAllText($known, "37.27.24.173 ssh-ed25519 $pinned`n[37.27.24.173]:2222 ssh-ed25519 $pinned`n", [Text.UTF8Encoding]::new($false))
  $options = @('-i',$adminKey,'-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',"UserKnownHostsFile=$known",'-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ConnectTimeout=15')
  & gh variable set PUZZORIA_AUTODEPLOY_ENABLED --repo $repo --body false
  Assert-Command 'suspension pendant la maintenance revue'
  [IO.File]::WriteAllText((Join-Path $directory 'approval.json'), ($approval | ConvertTo-Json -Depth 100 -Compress), [Text.UTF8Encoding]::new($false))
  $remote = '/tmp/puzzoria-reviewed-maintenance-' + [Guid]::NewGuid().ToString('N')
  & ssh @options root@37.27.24.173 "install -d -m 0700 '$remote'"
  Assert-Command 'dossier temporaire prive'
  & scp @options $archive $bundle (Join-Path $directory 'approval.json') "root@37.27.24.173:$remote/"
  Assert-Command 'copie du code revu sans cle privee'
  $receiptText = (& ssh @options root@37.27.24.173 "tar -xzf '$remote/puzzoria-controller.tar.gz' -C '$remote' && /usr/bin/flock --nonblock --conflict-exit-code 75 /run/lock/puzzoria-release.lock /usr/local/lib/puzzoria-release/node '$remote/release-reviewed-maintenance.mjs' '$remote/approval.json' '$remote/reviewed.bundle' '$remote'") -join "`n"
  Assert-Command 'publication de maintenance revue avec sauvegarde et rollback'
  $receipt = $receiptText | ConvertFrom-Json
  if ($receipt.sha -ne $ApprovedCommit -or $receipt.currentCommit -ne $ApprovedCommit -or $receipt.phase -ne 'healthy' -or $receipt.backup.verified -ne $true -or $receipt.policyUpdated -ne $true) { throw 'Recu sain complet absent ; activation maintenue suspendue.' }
  $checkOptions = @('-i',$deployKey,'-p','2222','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',"UserKnownHostsFile=$known",'-o','PasswordAuthentication=no','-o','BatchMode=yes','-o','ConnectTimeout=15')
  $check = ((& ssh @checkOptions puzzoria-release@37.27.24.173 check) -join "`n") | ConvertFrom-Json
  Assert-Command 'lecture independante du controleur restreint'
  if ($check.productionChanged -ne $false -or $check.state.phase -ne 'healthy' -or $check.state.currentCommit -ne $ApprovedCommit -or $check.image -ne $receipt.currentImage -or $check.schema -ne $receipt.schema) { throw 'Production observee differente du recu.' }
  $freshFile = Read-Json "repos/$repo/contents/agent/autonomy/state.json?ref=codex%2Fagent-state"
  $fresh = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($freshFile.content)) | ConvertFrom-Json
  if ($fresh.growth.reviewedMaintenance.sha -ne $ApprovedCommit -or $fresh.growth.reviewedMaintenance.policyHash -ne $PolicyHash -or $fresh.growth.lastDeployedCommit -notin @($approval.previousCommit,$ApprovedCommit)) { throw 'Etat GitHub concurrent ; ne pas ecraser la memoire.' }
  $fresh.growth.lastDeployedCommit = $ApprovedCommit
  if ($fresh.growth.pendingDeployment.mergeSha -eq $approval.previousCommit -and $fresh.growth.pendingDeployment.status -eq 'awaiting_policy_refresh') { $fresh.growth.pendingDeployment.status = 'deployed' }
  $fresh.growth.reviewedMaintenance.status = 'deployed'
  $fresh.growth.reviewedMaintenance | Add-Member -Force -NotePropertyName receipt -NotePropertyValue $receipt
  $fresh.generation = $fresh.generation + 1
  $content = $fresh | ConvertTo-Json -Depth 100 -Compress
  if ([Text.Encoding]::UTF8.GetByteCount($content) -gt 262144) { throw 'Etat trop volumineux ; aucune troncature autorisee.' }
  $body = @{message='Record the independently verified owner-reviewed maintenance receipt without changing memory or instructions';branch='codex/agent-state';sha=$freshFile.sha;content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($content))}
  $inputPath = Join-Path $directory 'state-update.json'
  [IO.File]::WriteAllText($inputPath, ($body | ConvertTo-Json -Depth 100 -Compress), [Text.UTF8Encoding]::new($false))
  & gh api --method PUT "repos/$repo/contents/agent/autonomy/state.json" --input $inputPath | Out-Null
  Assert-Command 'confirmation atomique du recu avec memoire et consignes conservees'
  if ($Activate) {
    & gh variable set PUZZORIA_AUTODEPLOY_ENABLED --repo $repo --body true
    Assert-Command 'reactivation deja autorisee des publications a faible risque'
    & gh workflow run autonomy-agent.yml --repo $repo --ref main
    if ($LASTEXITCODE -ne 0) { & gh variable set PUZZORIA_AUTODEPLOY_ENABLED --repo $repo --body false; throw 'Reveil non confirme ; publications suspendues.' }
  }
  Write-Output 'Maintenance saine, sauvegarde verifiee et recu enregistre. Suivi : https://github.com/Aimericv/puzzoria/issues/3'
} finally { Remove-Item -LiteralPath $directory -Recurse -Force -ErrorAction SilentlyContinue }
