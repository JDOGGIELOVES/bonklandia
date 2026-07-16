Add-Type -AssemblyName System.Drawing
$path = Join-Path $PSScriptRoot "..\public\assets\characters\bongachill.png"
$bmp = [System.Drawing.Bitmap]::FromFile($path)
Write-Host "Path: $path"
Write-Host "Size: $($bmp.Width)x$($bmp.Height)"
Write-Host "Format: $($bmp.PixelFormat)"
$transparent = 0
$opaque = 0
for ($y = 0; $y -lt [Math]::Min(50, $bmp.Height); $y++) {
  for ($x = 0; $x -lt [Math]::Min(50, $bmp.Width); $x++) {
    $p = $bmp.GetPixel($x, $y)
    if ($p.A -lt 10) { $transparent++ } else { $opaque++ }
  }
}
Write-Host "Sample corner: transparent=$transparent opaque=$opaque"
$bmp.Dispose()