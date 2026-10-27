[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$Activate,
  [string]$ApprovedCommit,
  [string]$PolicyHash,
  [string]$ValidationRunId,
  [string]$ArtifactName = 'reviewed-puzzoria-controller',
  [ValidateSet(22,2223)]
  [int]$AdminSshPort = 22,
  [string]$AdminKey = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $Apply) {
  Write-Output 'Préparation uniquement : aucune connexion VPS, clé ou configuration modifiée.'
  Write-Output 'Après autorisation explicite dans Codex : -Apply -Activate -ApprovedCommit SHA -PolicyHash HASH -ValidationRunId ID'
  return
}
if ($ApprovedCommit -notmatch '^[a-f0-9]{40}$' -or $PolicyHash -notmatch '^[a-f0-9]{64}$' -or $ValidationRunId -notmatch '^\d+$') { throw 'Révision, politique et exécution de validation exactes requises.' }
foreach ($command in @('gh','ssh','scp','ssh-keygen','ssh-keyscan','tar')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Commande gratuite requise sur ce PC : $command." }
}
if (-not $AdminKey) { $AdminKey = Join-Path $env:USERPROFILE '.ssh\puzzoria_deploy' }
if (-not (Test-Path -LiteralPath $AdminKey -PathType Leaf)) { throw 'Clé administrative locale introuvable ; ne la transmettez pas dans le chat.' }
function Assert-Native([string]$Operation) { if ($LASTEXITCODE -ne 0) { throw "Échec : $Operation (code $LASTEXITCODE)." } }
function Read-GitHubJson([string]$Endpoint) {
  $value = & gh api $Endpoint
  Assert-Native 'lecture GitHub'
  return (($value -join "`n") | ConvertFrom-Json)
}
$repo = 'Aimericv/puzzoria'
$stateFile = Read-GitHubJson "repos/$repo/contents/agent/autonomy/state.json?ref=codex%2Fagent-state"
$state = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($stateFile.content)) | ConvertFrom-Json
$approval = $state.growth.productionBootstrapApproval
$pending = $state.growth.pendingDeployment
if ($approval.sha -ne $ApprovedCommit -or $approval.policyHash -ne $PolicyHash -or $approval.validationRunId -ne $ValidationRunId -or -not $approval.approvedAt -or $pending.mergeSha -ne $ApprovedCommit -or $pending.ownerApprovedBootstrap -ne $true -or $pending.status -ne 'awaiting_activation') { throw 'Autorisation initiale exacte absente de l''état protégé ; aucune installation.' }
$controlFile = Read-GitHubJson "repos/$repo/contents/agent/autonomy/control.json?ref=$ApprovedCommit"
$control = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($controlFile.content)) | ConvertFrom-Json
if ($control.release.productionAuthorization.policyHash -ne $PolicyHash -or $control.release.target.sshHost -ne '37.27.24.173' -or $control.release.target.sshUser -ne 'puzzoria-release' -or $control.release.target.sshPort -ne 2222 -or $control.release.target.initialCommit -ne ('0' * 40)) { throw 'La cible ne correspond pas à l''autorisation initiale.' }
$directory = Join-Path ([IO.Path]::GetTempPath()) ('puzzoria-setup-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $directory | Out-Null
try {
  & gh run download $ValidationRunId --repo $repo --name $ArtifactName --dir $directory
  Assert-Native 'téléchargement du paquet contrôleur validé'
  $archive = Join-Path $directory 'puzzoria-controller.tar.gz'
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
  $declared = ((Get-Content -Raw (Join-Path $directory 'puzzoria-controller.sha256')).Trim() -split '\s+')[0]
  if ($hash -ne $declared -or $hash -ne $approval.controllerArchiveSha256) { throw 'Empreinte du paquet différente de l''autorisation.' }
  & tar -xzf $archive -C $directory
  Assert-Native 'extraction du paquet contrôleur'
  $manifest = Get-Content -Raw (Join-Path $directory 'VALIDATION.json') | ConvertFrom-Json
  if ($manifest.policyHash -ne $PolicyHash -or $manifest.source -ne $approval.validatedSource) { throw 'La politique ou la source du paquet ne correspond pas à la validation approuvée.' }
  $known = Join-Path $directory 'known_hosts'
  $pinned = $null
  $scanFile = Join-Path $directory 'host-key-scan.txt'
  $scan = Start-Process -FilePath (Get-Command ssh-keyscan).Source -ArgumentList @('-T','10','-p',"$AdminSshPort",'-t','ed25519','37.27.24.173') -Wait -PassThru -NoNewWindow -RedirectStandardOutput $scanFile -RedirectStandardError (Join-Path $directory 'host-key-scan.stderr')
  if ($scan.ExitCode -ne 0) { throw "Acces SSH administratif au port $AdminSshPort indisponible. Aucune modification du VPS." }
  $keys = Get-Content -LiteralPath $scanFile
  foreach ($line in $keys) {
    if ($line -match '^\S+\s+ssh-ed25519\s+([A-Za-z0-9+/=]+)(?:\s|$)') {
      $encoded = $Matches[1]
      $algorithm = [Security.Cryptography.SHA256]::Create()
      try { $fingerprint = 'SHA256:' + [Convert]::ToBase64String($algorithm.ComputeHash([Convert]::FromBase64String($encoded))).TrimEnd('=') } finally { $algorithm.Dispose() }
      if ($fingerprint -eq 'SHA256:7wiefI6XYd5fbKwZfx9Dyvk2UNY2sqnHgMc7CD+oXeg') { $pinned = $encoded; break }
    }
  }
  if (-not $pinned) { throw 'Empreinte SSH du VPS différente de celle confirmée par le propriétaire.' }
  $adminKnownHost = if ($AdminSshPort -eq 22) { '37.27.24.173' } else { "[37.27.24.173]:$AdminSshPort" }
  [IO.File]::WriteAllText($known, "$adminKnownHost ssh-ed25519 $pinned`n", [Text.UTF8Encoding]::new($false))
  $transportOptions = @('-i',$AdminKey,'-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',"UserKnownHostsFile=$known",'-o','ConnectTimeout=15')
  $sshOptions = $transportOptions + @('-p',"$AdminSshPort")
  $scpOptions = $transportOptions + @('-P',"$AdminSshPort")
  # Metadata only: do not print or copy either existing environment file.
  $environmentFile = (& ssh @sshOptions 'root@37.27.24.173' 'if test -f /opt/puzzoria/.env.docker; then echo /opt/puzzoria/.env.docker; elif test -f /opt/puzzoria/.env; then echo /opt/puzzoria/.env; else exit 1; fi') -join ''
  Assert-Native 'précontrôle du fichier de configuration existant'
  if ($environmentFile -notin @('/opt/puzzoria/.env.docker','/opt/puzzoria/.env')) { throw 'Configuration Compose existante inconnue.' }
  $deployKey = Join-Path $env:USERPROFILE '.ssh\puzzoria_release_auto_ed25519'
  if (-not (Test-Path -LiteralPath $deployKey)) {
    $argumentMode = Get-Variable PSNativeCommandArgumentPassing -ErrorAction SilentlyContinue
    if ($argumentMode -and $argumentMode.Value -ne 'Legacy') { & ssh-keygen -q -t ed25519 -N '' -f $deployKey -C 'puzzoria-restricted-release' }
    else { & ssh-keygen -q -t ed25519 -N '""' -f $deployKey -C 'puzzoria-restricted-release' }
    Assert-Native 'création de la clé distincte pour la commande restreinte'
  }
  & icacls $deployKey /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):F" | Out-Null
  Assert-Native 'restriction de la clé privée à ce compte Windows'
  $publicKey = & ssh-keygen -y -f $deployKey
  Assert-Native 'lecture de la clé publique de déploiement'
  [IO.File]::WriteAllText((Join-Path $directory 'deploy.pub'), ($publicKey -join '') + "`n", [Text.UTF8Encoding]::new($false))
  $config = @{schemaVersion=1;origin='https://puzzoria.com';appDirectory='/opt/puzzoria';composeFile='/opt/puzzoria/compose.yaml';environmentFile=$environmentFile;composeProject='dailygrid';appService='app';repository='/var/lib/puzzoria-release/repository.git';stateDirectory='/var/lib/puzzoria-release';initialCommit=('0' * 40);bootstrapApprovedCommit=$ApprovedCommit;policyHash=$PolicyHash}
  [IO.File]::WriteAllText((Join-Path $directory 'host-config.json'), ($config | ConvertTo-Json) + "`n", [Text.UTF8Encoding]::new($false))
  $remote = '/tmp/puzzoria-release-install-' + [Guid]::NewGuid().ToString('N')
  & ssh @sshOptions 'root@37.27.24.173' "install -d -m 0700 '$remote'"
  Assert-Native 'création du dossier temporaire privé sur le VPS'
  & scp @scpOptions $archive (Join-Path $directory 'host-config.json') (Join-Path $directory 'deploy.pub') "root@37.27.24.173:$remote/"
  Assert-Native 'copie du paquet contrôleur et de la seule clé publique'
  & ssh @sshOptions 'root@37.27.24.173' "tar -xzf '$remote/puzzoria-controller.tar.gz' -C '$remote' && bash '$remote/install-release-controller.sh' --apply '$remote/host-config.json' '$remote/deploy.pub'"
  Assert-Native 'installation du contrôleur restreint, sans remplacement de l''application'
  $deployKnown = Join-Path $directory 'deploy_known_hosts'
  [IO.File]::WriteAllText($deployKnown, "[37.27.24.173]:2222 ssh-ed25519 $pinned`n", [Text.UTF8Encoding]::new($false))
  $checkOptions = @('-i',$deployKey,'-p','2222','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',"UserKnownHostsFile=$deployKnown",'-o','PasswordAuthentication=no','-o','BatchMode=yes','-o','ConnectTimeout=15')
  $hostCheck = (& ssh @checkOptions 'puzzoria-release@37.27.24.173' 'check') -join "`n"
  Assert-Native 'verification du port restreint 2222 et du controleur installe'
  $checked = $hostCheck | ConvertFrom-Json
  if ($checked.productionChanged -ne $false -or $checked.state.phase -ne 'healthy' -or $checked.state.currentCommit -ne ('0' * 40)) { throw 'Etat initial du controleur non confirme ; aucune activation.' }
  # Private key travels only over gh stdin into a repository secret, never as argv or to the VPS.
  Get-Content -Raw -LiteralPath $deployKey | & gh secret set PUZZORIA_DEPLOY_KEY --repo $repo
  Assert-Native 'enregistrement sécurisé de la clé distincte dans GitHub'
  Get-Content -Raw -LiteralPath $deployKnown | & gh secret set PUZZORIA_DEPLOY_KNOWN_HOSTS --repo $repo
  Assert-Native 'enregistrement de l''empreinte SSH vérifiée'
  if ($Activate) {
    & gh variable set PUZZORIA_AUTODEPLOY_ENABLED --repo $repo --body true
    Assert-Native 'activation explicitement autorisée des publications'
    & gh workflow run autonomy-agent.yml --repo $repo --ref main -f deploy-pending=true
    if ($LASTEXITCODE -ne 0) {
      & gh variable set PUZZORIA_AUTODEPLOY_ENABLED --repo $repo --body false
      throw 'Le déclenchement initial a échoué ; réveils de production désactivés.'
    }
    Write-Output 'Première publication demandée. Les sauvegardes, contrôles et éventuel rollback s''exécutent sur GitHub et le VPS, même si ce PC est éteint.'
  }
  Write-Output 'Suivi et communication : https://github.com/Aimericv/puzzoria/issues/3'
} finally {
  Remove-Item -LiteralPath $directory -Recurse -Force -ErrorAction SilentlyContinue
}
