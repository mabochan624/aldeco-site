# Resize a photo for the blog using only what ships with Windows.
#   - decode with WIC (PresentationCore), so JPEG / PNG / HEIC all work
#   - honour the EXIF orientation flag so phone photos are upright
#   - shrink the long edge
#   - re-encode as JPEG WITHOUT metadata, which DROPS ALL EXIF INCLUDING GPS
#
# HEIC is why this uses WIC instead of System.Drawing: System.Drawing cannot
# decode HEIC at all, and iPhone photos are HEIC by default.
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
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$uri = New-Object System.Uri((Resolve-Path $Source).Path)
$decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($uri, 'None', 'OnLoad')
$image = [System.Windows.Media.Imaging.BitmapSource]$decoder.Frames[0]

# EXIF orientation. Query paths differ per container, so try the common ones.
# Some decoders (HEIF) already apply it and expose nothing here - that is fine.
$orientation = 1
if ($decoder.Frames[0].Metadata) {
  foreach ($q in @('/app1/ifd/{ushort=274}', '/ifd/{ushort=274}')) {
    try {
      $v = $decoder.Frames[0].Metadata.GetQuery($q)
      if ($v) { $orientation = [int]$v; break }
    } catch { }
  }
}

$angle = 0
switch ($orientation) {
  3 { $angle = 180 }
  6 { $angle = 90 }
  8 { $angle = 270 }
}
if ($angle -ne 0) {
  $rotate = New-Object System.Windows.Media.RotateTransform -ArgumentList $angle
  $image = New-Object System.Windows.Media.Imaging.TransformedBitmap -ArgumentList $image, $rotate
}

if ($image.PixelWidth -gt $MaxWidth) {
  $factor = $MaxWidth / $image.PixelWidth
  $scale = New-Object System.Windows.Media.ScaleTransform -ArgumentList $factor, $factor
  $image = New-Object System.Windows.Media.Imaging.TransformedBitmap -ArgumentList $image, $scale
}

# Creating the frame from the transformed source carries no metadata,
# so the encoded JPEG has no EXIF and therefore no GPS.
$encoder = New-Object System.Windows.Media.Imaging.JpegBitmapEncoder
$encoder.QualityLevel = $Quality
$encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($image))

$stream = [System.IO.File]::Create($Dest)
try { $encoder.Save($stream) } finally { $stream.Close() }

Write-Output ("" + $image.PixelWidth + " x " + $image.PixelHeight)
