$ErrorActionPreference = 'Stop'

$composeCommands = @(
  @('docker', 'compose', 'up', '-d', '--build'),
  @('podman', 'compose', 'up', '-d', '--build')
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

throw 'No se pudo levantar la infraestructura. Prueba con Podman o Docker Desktop activo.'
