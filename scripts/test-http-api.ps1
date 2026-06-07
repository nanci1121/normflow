Write-Host "=== Verificando API ===" -ForegroundColor Cyan
try {
  $login = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -Body '{"email":"admin@qms.local","password":"Admin123!"}' -ContentType "application/json" -ErrorAction Stop
  $token = $login.accessToken
  $docs = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/documents" -Method GET -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
  Write-Host "Documentos: $($docs.items.Count)" -ForegroundColor Green
  foreach ($d in $docs.items) {
    $circuitInfo = if ($d.approvalCircuit) { "Circuito: $($d.approvalCircuit.category) · $($d.approvalCircuit.steps.Count) pasos" } else { "Sin circuito" }
    Write-Host "  [$($d.status)] $($d.code) - $($d.title)`n         $circuitInfo" -ForegroundColor Yellow
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
Read-Host "`nPresiona Enter para salir"
