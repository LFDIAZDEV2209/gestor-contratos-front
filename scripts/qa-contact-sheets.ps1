param([string]$Round = 'qa2')
Add-Type -AssemblyName System.Drawing

$localCapture = Join-Path $PSScriptRoot '..\.playwright-mcp'
$parentCapture = 'C:\Users\Luis\Documents\Nexo\Repos\.playwright-mcp'
$captureRoot = if (Test-Path $localCapture) { (Resolve-Path $localCapture).Path } else { $parentCapture }

$qaRoot = 'C:\Users\Luis\AppData\Local\Temp\opencode\qa-redise' + [char]0xF1 + 'o'
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null

Write-Host "Buscando capturas en $captureRoot con patron $Round-*-1440.png..."
Get-ChildItem -LiteralPath $captureRoot -Filter "$Round-*-1440.png" | ForEach-Object {
  $stem = $_.BaseName.Substring(0, $_.BaseName.Length - 5)
  Write-Host "Generando hoja de contacto para $stem..."
  $canvas = New-Object System.Drawing.Bitmap(2160, 1940)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::FromArgb(223,230,232))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $font = New-Object System.Drawing.Font('Arial', 14)
  $positions = @(@(1440,0,30,1080,675),@(1280,1080,30,1080,675),@(768,0,755,768,1024),@(390,1080,755,390,844))
  foreach($slot in $positions) {
    $source = Join-Path $captureRoot "$stem-$($slot[0]).png"
    if(Test-Path -LiteralPath $source) {
      Copy-Item -LiteralPath $source -Destination (Join-Path $qaRoot "$stem-$($slot[0]).png") -Force
      $bitmap = [System.Drawing.Image]::FromFile($source)
      $graphics.DrawString("$stem | $($slot[0])px", $font, [System.Drawing.Brushes]::Black, [single]$slot[1], [single]($slot[2]-27))
      $graphics.DrawImage($bitmap, [int]$slot[1], [int]$slot[2], [int]$slot[3], [int]$slot[4])
      $bitmap.Dispose()
    }
  }
  $graphics.Dispose(); $font.Dispose()
  $targetSheet = Join-Path $qaRoot "$stem-sheet.png"
  $canvas.Save($targetSheet, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  Write-Host "Guardado: $targetSheet"
}
