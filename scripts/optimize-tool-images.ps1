param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,

  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,

  [int]$MaxDimension = 1024,

  [ValidateSet('png', 'jpeg')]
  [string]$Format = 'png',

  [int]$JpegQuality = 82
)

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

Get-ChildItem -LiteralPath $SourceDirectory -File | Where-Object Extension -eq '.png' | ForEach-Object {
  $source = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    $longestSide = [Math]::Max($source.Width, $source.Height)
    $scale = [Math]::Min(1.0, $MaxDimension / [double]$longestSide)
    $width = [Math]::Max(1, [Math]::Round($source.Width * $scale))
    $height = [Math]::Max(1, [Math]::Round($source.Height * $scale))
    $extension = if ($Format -eq 'jpeg') { '.jpg' } else { '.png' }
    $outputPath = Join-Path $OutputDirectory ([System.IO.Path]::GetFileNameWithoutExtension($_.Name) + $extension)
    $pixelFormat = if ($Format -eq 'jpeg') {
      [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    } else {
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    }
    $bitmap = [System.Drawing.Bitmap]::new($width, $height, $pixelFormat)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $backgroundColor = if ($Format -eq 'jpeg') {
        [System.Drawing.Color]::White
      } else {
        [System.Drawing.Color]::Transparent
      }
      $graphics.Clear($backgroundColor)
      $graphics.DrawImage($source, 0, 0, $width, $height)
      if ($Format -eq 'jpeg') {
        $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
          Where-Object MimeType -eq 'image/jpeg'
        $encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
        $encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
          [System.Drawing.Imaging.Encoder]::Quality,
          [long]$JpegQuality
        )
        $bitmap.Save($outputPath, $jpegCodec, $encoderParameters)
        $encoderParameters.Dispose()
      } else {
        $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      }
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
    [pscustomobject]@{
      Name = $_.Name
      OriginalBytes = $_.Length
      OptimizedBytes = (Get-Item -LiteralPath $outputPath).Length
      Width = $width
      Height = $height
    }
  } finally {
    $source.Dispose()
  }
} | Sort-Object Name
