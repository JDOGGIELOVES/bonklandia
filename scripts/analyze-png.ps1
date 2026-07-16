Add-Type -AssemblyName System.Drawing
$path = Join-Path $PSScriptRoot "..\public\assets\characters\bongachill.png"
$bmp = [System.Drawing.Bitmap]::FromFile($path)
$transparent = 0
$opaqueBlack = 0
$opaqueOther = 0
for ($y = 0; $y -lt $bmp.Height; $y++) {
  for ($x = 0; $x -lt $bmp.Width; $x++) {
    $p = $bmp.GetPixel($x, $y)
    if ($p.A -lt 20) { $transparent++ }
    elseif ($p.R -le 45 -and $p.G -le 45 -and $p.B -le 45) { $opaqueBlack++ }
    else { $opaqueOther++ }
  }
}
Write-Host "transparent=$transparent opaqueBlack=$opaqueBlack opaqueOther=$opaqueOther"
$bmp.Dispose()