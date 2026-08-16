# Resize a photo for the blog using only .NET (no extra install needed).
#   - honour the EXIF orientation flag so phone photos are upright
#   - shrink the long edge
#   - re-encode as JPEG, which DROPS ALL EXIF INCLUDING GPS
#
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads a .ps1 without a
# BOM as ANSI, so non-ASCII comments corrupt the script. Japanese notes live in
# tools/photo.mjs instead.

param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Dest,
  [int]$MaxWidth = 1600,
  [int]$Quality = 82
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($Source)
try {
  $orientationId = 0x0112
  if ($img.PropertyIdList -contains $orientationId) {
    $o = $img.GetPropertyItem($orientationId).Value[0]
    switch ($o) {
      3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
  }

  $w = $img.Width
  $h = $img.Height
  if ($w -gt $MaxWidth) {
    $h = [int][Math]::Round($h * $MaxWidth / $w)
    $w = $MaxWidth
  }

  # Drawing into a fresh Bitmap is what strips the EXIF metadata.
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode    = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode      = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode        = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingQuality   = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $encParams = New-Object System.Drawing.Imaging.EncoderParameters -ArgumentList 1
  $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter -ArgumentList ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

  $bmp.Save($Dest, $codec, $encParams)
  $bmp.Dispose()

  Write-Output "$w x $h"
}
finally {
  $img.Dispose()
}
