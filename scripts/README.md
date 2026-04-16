# Bloom — Video Compression

The 6 UGC `.mov` files in `public/images/` total **~215 MB** — that's a disaster for mobile conversion. Costa Rica mobile users on 3G/4G will bounce before the hero video even loads.

## What the site does today

The UGC carousel in `index.html` uses the raw `.mov` files via `data-src`. Modern browsers CAN play iPhone `.mov` (they're H.264/HEVC in a QuickTime container), but:

- iOS Safari may reject HEVC in `<video>`
- File sizes are 25–42 MB each → awful on mobile
- Videos are lazy-loaded (only load when near viewport) — but still heavy

## Fix: compress to MP4 + WebM

### Step 1 — Install ffmpeg (one-time)

```powershell
winget install Gyan.FFmpeg
```

Then **restart your terminal** so the PATH refreshes.

### Step 2 — Run the compression script

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\compress-videos.ps1
```

This reads every `.mov` in `public/images/`, produces a `.mp4` (H.264) and a `.webm` (VP9) next to it, scaled to max 720px wide. Expect ~90% size reduction:

| Original | After compression |
|---|---|
| `Video1.mov` — 24 MB | `Video1.mp4` — ~2.5 MB |
| `Pimple Patches 2.mov` — 42 MB | `Pimple Patches 2.mp4` — ~4 MB |

### Step 3 — Update `index.html`

Change each `data-src` attribute from `.mov` to `.mp4`:

```html
<!-- before -->
<video ... data-src="/images/Video1.mov" ...></video>

<!-- after -->
<video ... data-src="/images/Video1.mp4" ...></video>
```

The carousel JS will pick it up with zero other changes. If you want the WebM variant too, swap `<video>` to use `<source>` tags (but MP4 alone is fine for 99% of browsers).

### Step 4 — Delete the original `.mov` files

```powershell
Remove-Item .\public\images\*.mov
```

They stay in git history if you need them back.

## Alternative — online tool

If you can't install ffmpeg, drag each `.mov` to [cloudconvert.com](https://cloudconvert.com/mov-to-mp4) and use these settings:

- Video codec: `H.264`
- Resolution: `720p` (or keep original if source is already ≤720p)
- CRF / Quality: `26`
- Audio bitrate: `96 kbps`

Download and drop the resulting `.mp4` files into `public/images/`.
