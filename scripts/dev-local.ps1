param(
  [switch]$SkipDbCheck,
  [switch]$SkipSeed
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$Backend = Join-Path $Root "backend"

Write-Host "=== QMS Platform - Dev Local ===" -ForegroundColor Cyan

# 1. Verificar Node.js
try {
  $nodeVer = node --version
  Write-Host "[OK] Node.js $nodeVer" -ForegroundColor Green
} catch {
  Write-Host "[ERROR] Node.js no instalado. Descargalo de https://nodejs.org" -ForegroundColor Red
  exit 1
}

# 2. Verificar PostgreSQL
if (-not $SkipDbCheck) {
  try {
    $connStr = "host=localhost port=5432 dbname=qms_platform user=qms password=qms_secret"
    $pgCheck = node -e "
      const { Client } = require('pg');
      const c = new Client({ connectionString: 'postgresql://qms:qms_secret@localhost:5432/qms_platform?schema=public' });
      c.connect().then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.log('FAIL:'+e.message); process.exit(1); });
    "
    if ($pgCheck -like "FAIL*") {
      throw $pgCheck
    }
    Write-Host "[OK] PostgreSQL conectado" -ForegroundColor Green
  } catch {
    Write-Host "[ERROR] No se pudo conectar a PostgreSQL en localhost:5432" -ForegroundColor Red
    Write-Host "  Asegurate de que PostgreSQL esta corriendo y ejecuta:" -ForegroundColor Yellow
    Write-Host "  psql -U postgres -c `"CREATE USER qms WITH PASSWORD 'qms_secret';`"" -ForegroundColor Yellow
    Write-Host "  psql -U postgres -c `"CREATE DATABASE qms_platform OWNER qms;`"" -ForegroundColor Yellow
    Write-Host "  O usa -SkipDbCheck para saltar esta verificacion" -ForegroundColor Yellow
    exit 1
  }
}

# 3. Instalar dependencias si faltan
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Host "[...] Instalando dependencias raiz..." -ForegroundColor Cyan
  Push-Location $Root
  npm install
  Pop-Location
}
if (-not (Test-Path (Join-Path $Backend "node_modules"))) {
  Write-Host "[...] Instalando dependencias backend..." -ForegroundColor Cyan
  Push-Location $Backend
  npm install
  Pop-Location
}

# 4. Prisma generate + migrate
Push-Location $Backend
Write-Host "[...] Prisma generate..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate fallo" }

Write-Host "[...] Prisma migrate..." -ForegroundColor Cyan
npx prisma migrate dev
if ($LASTEXITCODE -ne 0) { throw "prisma migrate fallo" }

if (-not $SkipSeed) {
  Write-Host "[...] Prisma seed..." -ForegroundColor Cyan
  npx prisma db seed
  if ($LASTEXITCODE -ne 0) { throw "prisma seed fallo" }
}
Pop-Location

# 5. Liberar puertos
Write-Host "[...] Liberando puertos 3000 y 5173..." -ForegroundColor Cyan
& (Join-Path $Root "scripts\free-dev-ports.ps1")

# 6. Arrancar backend + frontend
Write-Host "[OK] Arrancando servicios..." -ForegroundColor Green
Write-Host "     Backend  -> http://localhost:3000" -ForegroundColor Cyan
Write-Host "     Frontend -> http://localhost:5173" -ForegroundColor Cyan

Push-Location $Root
npx concurrently -k -n backend,frontend "npm --prefix backend run dev" "npm --prefix frontend run dev"
Pop-Location
