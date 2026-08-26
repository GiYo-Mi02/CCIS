[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
  [Parameter(Mandatory)]
  [string]$SecretsEnvFile,
  [switch]$ConfirmProduction,
  [string]$SupabaseCliVersion = '2.115.0'
)

$ErrorActionPreference = 'Stop'

if (-not $ConfirmProduction) {
  throw 'Production deployment is disabled. Re-run with -ConfirmProduction only after explicit release approval.'
}

$resolvedSecretsFile = (Resolve-Path -LiteralPath $SecretsEnvFile).Path
if ($resolvedSecretsFile.EndsWith('.example', [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Copy the example to an ignored file and replace every placeholder before deployment.'
}

$secretFileContent = Get-Content -LiteralPath $resolvedSecretsFile -Raw
$requiredSecrets = @('EMAIL_WORKER_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'APP_ORIGIN')

foreach ($secretName in $requiredSecrets) {
  $match = [regex]::Match(
    $secretFileContent,
    "(?m)^\s*$([regex]::Escape($secretName))=(.+)$"
  )

  if (-not $match.Success) {
    throw "The secret file is missing required name $secretName."
  }

  $secretValue = $match.Groups[1].Value.Trim()
  if ([string]::IsNullOrWhiteSpace($secretValue) -or
      $secretValue -like 'replace-*' -or
      $secretValue.Contains('<replace-')) {
    throw "The secret file still contains a placeholder for $secretName."
  }
}

if ($secretFileContent -match '(?m)^\s*VITE_') {
  throw 'Hosted secrets must never use VITE_ names because Vite exposes them to browser code.'
}

$supabaseCommand = @('--yes', "supabase@$SupabaseCliVersion")
$target = 'the linked Supabase production project'

if ($PSCmdlet.ShouldProcess($target, 'Set Edge Function secrets and deploy reviewed functions')) {
  & npx.cmd @supabaseCommand secrets set --env-file $resolvedSecretsFile
  if ($LASTEXITCODE -ne 0) { throw 'Setting Edge Function secrets failed.' }

  & npx.cmd @supabaseCommand functions deploy process-email-queue --no-verify-jwt --use-api
  if ($LASTEXITCODE -ne 0) { throw 'Deploying process-email-queue failed.' }

  & npx.cmd @supabaseCommand functions deploy delete-user send-ticket-email --use-api
  if ($LASTEXITCODE -ne 0) { throw 'Deploying JWT-protected Edge Functions failed.' }

  Write-Host 'Hosted Edge secrets and functions were updated.'
  Write-Host 'Next: configure matching Vault values, apply the reviewed migration, then run scripts/check-hosted-release.ps1.'
}
