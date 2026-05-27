$ErrorActionPreference = 'Stop'

$ports = @(3000, 5173)
$connections = Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue

if (-not $connections) {
  exit 0
}

$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
  } catch {
    continue
  }
}
