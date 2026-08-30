[CmdletBinding()]
param(
  [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$GitBash = 'C:\Program Files\Git\bin\bash.exe',
  [ValidateRange(1024, 65535)]
  [int]$Port = 55432
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$initdb = Join-Path $PostgresBin 'initdb.exe'
$pgCtl = Join-Path $PostgresBin 'pg_ctl.exe'
$psql = Join-Path $PostgresBin 'psql.exe'

foreach ($executable in @($initdb, $pgCtl, $psql)) {
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "Required PostgreSQL executable was not found: $executable"
  }
}
if (-not (Test-Path -LiteralPath $GitBash -PathType Leaf)) {
  throw "Git Bash is required for the registration concurrency test: $GitBash"
}

$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$dataDir = [System.IO.Path]::GetFullPath(
  (Join-Path $tempRoot "ccis-local-postgres-$PID")
)

if (-not $dataDir.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    ([System.IO.Path]::GetFileName($dataDir) -notlike 'ccis-local-postgres-*')) {
  throw "Refusing to use an unsafe temporary database path: $dataDir"
}

$serverStarted = $false

try {
  New-Item -ItemType Directory -Path $dataDir | Out-Null
  $serverLog = Join-Path $dataDir 'postgres.log'

  & $initdb --pgdata=$dataDir --auth=trust --username=postgres --encoding=UTF8 --no-locale
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }

  & $pgCtl --pgdata=$dataDir --log=$serverLog --options="-p $Port" --wait start
  if ($LASTEXITCODE -ne 0) { throw 'pg_ctl start failed' }
  $serverStarted = $true

  $databaseUrl = "postgresql://postgres@127.0.0.1:$Port/postgres"
  $bootstrap = Join-Path $repoRoot 'supabase\tests\local_supabase_bootstrap.sql'
  & $psql $databaseUrl --set ON_ERROR_STOP=1 --file $bootstrap
  if ($LASTEXITCODE -ne 0) { throw 'Local Supabase bootstrap failed' }

  $migrations = Get-ChildItem (Join-Path $repoRoot 'supabase\migrations') -Filter '*.sql' |
    Sort-Object Name

  foreach ($migration in $migrations) {
    if ($migration.Name -eq '20260824124000_scheduled_email_worker.sql') {
      Write-Host "Applying local substitute for $($migration.Name) (pg_net, pg_cron, and Vault are Supabase-only)."
      $localWorkerBootstrap = Join-Path $repoRoot 'supabase\tests\local_scheduled_email_worker_bootstrap.sql'
      & $psql $databaseUrl --set ON_ERROR_STOP=1 --file $localWorkerBootstrap
      if ($LASTEXITCODE -ne 0) { throw 'Local scheduled email worker bootstrap failed' }
      continue
    }

    Write-Host "Applying $($migration.Name)"
    & $psql $databaseUrl --set ON_ERROR_STOP=1 --file $migration.FullName
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($migration.Name)" }
  }

  $tests = @(
    'security_contract.sql',
    'public_content_rls.sql',
    'profile_least_privilege.sql',
    'gallery_rls.sql',
    'messages_rls.sql',
    'attendance_rpc.sql',
    'email_queue_recovery.sql',
    'email_worker_outcomes.sql',
    'client_error_events.sql',
    'scaling_performance.sql'
  )

  foreach ($testName in $tests) {
    $testPath = Join-Path $repoRoot "supabase\tests\$testName"
    Write-Host "Running $testName"
    & $psql $databaseUrl --set ON_ERROR_STOP=1 --file $testPath
    if ($LASTEXITCODE -ne 0) { throw "Database test failed: $testName" }
  }

  Write-Host 'Running registration_checkin_concurrency.sh'
  $previousDatabaseUrl = $env:SUPABASE_DB_URL
  $previousPath = $env:PATH
  try {
    $env:SUPABASE_DB_URL = $databaseUrl
    $env:PATH = "$PostgresBin;$previousPath"
    Push-Location $repoRoot
    try {
      & $GitBash 'supabase/tests/registration_checkin_concurrency.sh'
      if ($LASTEXITCODE -ne 0) { throw 'Registration check-in concurrency test failed' }
    }
    finally {
      Pop-Location
    }
  }
  finally {
    $env:SUPABASE_DB_URL = $previousDatabaseUrl
    $env:PATH = $previousPath
  }

  Write-Host 'Local PostgreSQL migration replay and SQL behavior tests passed.'
}
finally {
  if ($serverStarted) {
    & $pgCtl --pgdata=$dataDir --mode=fast --wait stop
  }

  $resolvedDataDir = [System.IO.Path]::GetFullPath($dataDir)
  if ($resolvedDataDir.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
      ([System.IO.Path]::GetFileName($resolvedDataDir) -like 'ccis-local-postgres-*') -and
      (Test-Path -LiteralPath $resolvedDataDir)) {
    Remove-Item -LiteralPath $resolvedDataDir -Recurse -Force
  }
}
