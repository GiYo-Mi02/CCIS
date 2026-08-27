param(
  [string]$SupabaseCliVersion = '2.115.0'
)

$ErrorActionPreference = 'Stop'
$requiredFunctions = @('process-email-queue', 'delete-user', 'send-ticket-email')
$requiredSecrets = @('EMAIL_WORKER_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'APP_ORIGIN')
$supabaseCommand = @('--yes', "supabase@$SupabaseCliVersion")
$failures = [System.Collections.Generic.List[string]]::new()

function Invoke-SupabaseJson {
  param([string[]]$Arguments)

  $raw = & npx.cmd @supabaseCommand @Arguments --output json
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase command failed: $($Arguments -join ' ')"
  }
  return $raw | ConvertFrom-Json
}

$functions = Invoke-SupabaseJson -Arguments @('functions', 'list')
$activeFunctionNames = @(
  $functions |
    Where-Object { $_.status -eq 'ACTIVE' } |
    ForEach-Object { $_.name }
)
$missingFunctions = @($requiredFunctions | Where-Object { $_ -notin $activeFunctionNames })
if ($missingFunctions.Count -gt 0) {
  $failures.Add("Missing ACTIVE Edge Functions: $($missingFunctions -join ', ')")
}

$secrets = Invoke-SupabaseJson -Arguments @('secrets', 'list')
$secretNames = @($secrets | ForEach-Object { $_.name })
$missingSecrets = @($requiredSecrets | Where-Object { $_ -notin $secretNames })
if ($missingSecrets.Count -gt 0) {
  $failures.Add("Missing Edge Function secrets: $($missingSecrets -join ', ')")
}

& npx.cmd @supabaseCommand db query --linked --file 'supabase/release_checks/hosted_database_readiness.sql' --dns-resolver https
if ($LASTEXITCODE -ne 0) {
  $failures.Add('Hosted database readiness checks failed (Vault, cron, queue, or RLS contract).')
}

& npx.cmd @supabaseCommand migration list --linked --dns-resolver https
if ($LASTEXITCODE -ne 0) {
  $failures.Add('Unable to compare local and hosted migration history.')
}

if ($failures.Count -gt 0) {
  $message = "Hosted release is blocked:`n - " + ($failures -join "`n - ")
  throw $message
}

Write-Host 'Hosted inventory checks passed. Review delivery_unknown rows and migration alignment before approving merge.'
