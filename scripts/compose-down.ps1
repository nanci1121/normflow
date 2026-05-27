$ErrorActionPreference = 'Stop'

$composeCommands = @(
  @('podman', 'compose', 'down'),
  @('docker', 'compose', 'down')
)

foreach ($command in $composeCommands) {
  try {
    & $command[0] $command[1..($command.Count - 1)]
    if ($LASTEXITCODE -eq 0) {
      exit 0
    }
  } catch {
    continue
  }
}

throw 'No se pudo detener la infraestructura. Prueba con Podman o Docker Desktop activo.'
