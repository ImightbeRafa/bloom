# ─── Bloom — Video Compression Script ─────────────────────────────────────────
# Converts .mov UGC videos in public/images/ to web-optimized .mp4 (H.264) + .webm.
# Drops file size by ~90% (e.g. 42MB → 3-5MB) so mobile users actually watch them.
#
# Prereqs: ffmpeg installed and on PATH.
#   winget install Gyan.FFmpeg
#   (restart your shell after install so PATH refreshes)
#
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\compress-videos.ps1

$ErrorActionPreference = 'Stop'

# Verify ffmpeg
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "ERROR: ffmpeg is not installed or not on PATH." -ForegroundColor Red
  Write-Host ""
  Write-Host "Install it with:" -ForegroundColor Yellow
  Write-Host "    winget install Gyan.FFmpeg" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Then RESTART your terminal and re-run this script." -ForegroundColor Yellow
  exit 1
}

$imagesDir = Join-Path $PSScriptRoot "..\public\images"
$imagesDir = (Resolve-Path $imagesDir).Path

Write-Host ""
Write-Host "Compressing .mov files in:" -ForegroundColor Cyan
Write-Host "  $imagesDir"
Write-Host ""

$movFiles = Get-ChildItem -Path $imagesDir -Filter "*.mov"

if ($movFiles.Count -eq 0) {
  Write-Host "No .mov files found. Nothing to do." -ForegroundColor Yellow
  exit 0
}

foreach ($file in $movFiles) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $mp4Out = Join-Path $imagesDir "$baseName.mp4"
  $webmOut = Join-Path $imagesDir "$baseName.webm"

  $originalSizeMB = [math]::Round($file.Length / 1MB, 2)
  Write-Host "→ $($file.Name) ($originalSizeMB MB)" -ForegroundColor White

  # ── MP4 (H.264) — widest compatibility, iOS Safari, older browsers ─────────
  # -vf: scale to max 720px wide (vertical UGC is fine at this res), even dims
  # -crf 26: visually transparent quality for web, strong compression
  # -preset medium: balanced speed/size
  # -movflags +faststart: allows progressive streaming before full download
  # -an: strip audio for silent autoplay (comment out if you want sound)
  if (-not (Test-Path $mp4Out)) {
    Write-Host "  → MP4..." -ForegroundColor DarkGray
    & ffmpeg -hide_banner -loglevel error -y -i $file.FullName `
      -vf "scale='min(720,iw)':-2" `
      -c:v libx264 -crf 26 -preset medium -pix_fmt yuv420p `
      -movflags +faststart `
      -c:a aac -b:a 96k `
      $mp4Out
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  ✗ MP4 conversion failed" -ForegroundColor Red
      continue
    }
    $mp4SizeMB = [math]::Round((Get-Item $mp4Out).Length / 1MB, 2)
    Write-Host "    MP4:  $mp4SizeMB MB" -ForegroundColor Green
  } else {
    Write-Host "    MP4 already exists — skipping" -ForegroundColor DarkGray
  }

  # ── WebM (VP9) — smaller for Chrome/Firefox/Android ────────────────────────
  if (-not (Test-Path $webmOut)) {
    Write-Host "  → WebM..." -ForegroundColor DarkGray
    & ffmpeg -hide_banner -loglevel error -y -i $file.FullName `
      -vf "scale='min(720,iw)':-2" `
      -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 `
      -c:a libopus -b:a 80k `
      $webmOut
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  ✗ WebM conversion failed (non-fatal)" -ForegroundColor Yellow
    } else {
      $webmSizeMB = [math]::Round((Get-Item $webmOut).Length / 1MB, 2)
      Write-Host "    WebM: $webmSizeMB MB" -ForegroundColor Green
    }
  } else {
    Write-Host "    WebM already exists — skipping" -ForegroundColor DarkGray
  }

  Write-Host ""
}

Write-Host "Done." -ForegroundColor Green
Write-Host ""
Write-Host "Next step: update the data-src attribute in index.html to point to" -ForegroundColor Yellow
Write-Host "the .mp4 files (drop the .mov extension). The UGC carousel JS will" -ForegroundColor Yellow
Write-Host "pick them up automatically." -ForegroundColor Yellow
Write-Host ""
