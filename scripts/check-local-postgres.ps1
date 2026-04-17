$env:PGPASSWORD = "hermetical"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

if (-not (Test-Path $psql)) {
  Write-Error "psql.exe not found at $psql"
  exit 1
}

& $psql -h 127.0.0.1 -U hermetical -d hermetical -c "select current_user, current_database();"
