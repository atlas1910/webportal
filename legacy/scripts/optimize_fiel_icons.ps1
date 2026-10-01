param(
  [Parameter(Mandatory = $true)]
  [string]$Directory,
  [ValidateRange(16, 512)]
  [int]$Size = 96
)

Add-Type -AssemblyName System.Drawing

Get-ChildItem -LiteralPath $Directory -File -Filter '*.png' | ForEach-Object {
  $source = [System.Drawing.Image]::FromFile($_.FullName)
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $temporaryPath = "$($_.FullName).optimized.png"
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $scale = [Math]::Min($Size / $source.Width, $Size / $source.Height)
    $width = [int][Math]::Round($source.Width * $scale)
    $height = [int][Math]::Round($source.Height * $scale)
    $x = [int][Math]::Floor(($Size - $width) / 2)
    $y = [int][Math]::Floor(($Size - $height) / 2)
    $graphics.DrawImage($source, $x, $y, $width, $height)
    $bitmap.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $source.Dispose()
  }
  Move-Item -LiteralPath $temporaryPath -Destination $_.FullName -Force
}
