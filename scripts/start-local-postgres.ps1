$postgresBin = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
$postgresData = "C:\Program Files\PostgreSQL\18\data"

if (-not (Test-Path $postgresBin)) {
  Write-Error "postgres.exe not found at $postgresBin"
  exit 1
}

if (-not (Test-Path $postgresData)) {
  Write-Error "Postgres data directory not found at $postgresData"
  exit 1
}

Write-Host "Starting local PostgreSQL from $postgresData"
Write-Host "Keep this terminal open while the backend is running."

& $postgresBin -D $postgresData
