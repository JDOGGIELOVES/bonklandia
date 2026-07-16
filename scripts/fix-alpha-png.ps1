# Remove background by flood-filling dark pixels from image edges.
# Preserves existing alpha and inner dark details (hair, nose, shadows).
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$Threshold = 50
)

Add-Type -AssemblyName System.Drawing

function Get-Idx($x, $y, $w) { return $y * $w + $x }

$src = [System.Drawing.Bitmap]::FromFile($Path)
$w = $src.Width
$h = $src.Height
$n = $w * $h

$alpha = New-Object int[] $n
$red = New-Object int[] $n
$green = New-Object int[] $n
$blue = New-Object int[] $n
$remove = New-Object bool[] $n

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $i = Get-Idx $x $y $w
        $p = $src.GetPixel($x, $y)
        $alpha[$i] = [int]$p.A
        $red[$i] = [int]$p.R
        $green[$i] = [int]$p.G
        $blue[$i] = [int]$p.B
        $remove[$i] = $false
    }
}

function Test-Background([int]$i) {
    if ($alpha[$i] -lt 20) { return $true }
    return ($red[$i] -le $Threshold -and $green[$i] -le $Threshold -and $blue[$i] -le $Threshold)
}

$queue = New-Object System.Collections.Generic.Queue[int]

$lastY = $h - 1
$lastX = $w - 1
for ($x = 0; $x -lt $w; $x++) {
    foreach ($y in @(0, $lastY)) {
        $i = Get-Idx $x $y $w
        if (Test-Background $i) { $queue.Enqueue($i); $remove[$i] = $true }
    }
}
for ($y = 0; $y -lt $h; $y++) {
    foreach ($x in @(0, $lastX)) {
        $i = Get-Idx $x $y $w
        if (-not $remove[$i] -and (Test-Background $i)) { $queue.Enqueue($i); $remove[$i] = $true }
    }
}

while ($queue.Count -gt 0) {
    $i = $queue.Dequeue()
    $x = $i % $w
    $y = [Math]::Floor($i / $w)
    foreach ($nbr in @(
        @( $x - 1, $y ), @( $x + 1, $y ), @( $x, $y - 1 ), @( $x, $y + 1 )
    )) {
        $nx = $nbr[0]; $ny = $nbr[1]
        if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
        $ni = Get-Idx $nx $ny $w
        if ($remove[$ni]) { continue }
        if (Test-Background $ni) {
            $remove[$ni] = $true
            $queue.Enqueue($ni)
        }
    }
}

$dst = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $i = Get-Idx $x $y $w
        if ($remove[$i]) {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha[$i], $red[$i], $green[$i], $blue[$i]))
        }
    }
}

$src.Dispose()
$dst.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
Write-Host "Edge flood-fill transparency applied: $Path"