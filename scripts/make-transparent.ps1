# Strip black backgrounds from character PNGs using edge flood-fill.
# Preserves existing alpha and inner dark details (hair, shadows).
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir "fix-alpha-png.mjs"
node $nodeScript --all