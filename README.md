# Code Samples: Jeremy Phillips

Curated source files from three of my personal projects, shared in support of a job application. These are **read-only samples**, not runnable projects; each subdirectory pulls representative files out of a larger working app so you can review the code without setting anything up.

The full projects are private; if you'd like a live demo or a walkthrough of the rest of the codebase, I'm happy to share more.

## Contents

### [`track-tagger/`](./track-tagger): React + Vite + TypeScript

A browser-based audio metadata (ID3 tag) editor. Users drag in audio files, edit tags individually or in batch, and download the re-tagged files, all client-side with no upload, using FFmpeg compiled to WebAssembly.

Live at [audiotagger.io](https://audiotagger.io)

**Highlights demonstrated in the samples:**

- Client-side audio processing via `@ffmpeg/ffmpeg` (WASM)
- Custom hook pattern (`useMetadataEditor`) separating state/effects from UI
- Zustand store with `Map`-based pending-edit tracking
- Complex form UI with mixed-value detection across multi-selection
- Image processing utilities (artwork resize to 1400×1400)

### [`wavetrimmer/`](./wavetrimmer): Next.js 16 + React 19 + FFmpeg WASM + peaks.js

A browser-based audio editor: trim to an exact waveform range, normalize loudness, convert format, and add intro/outro clips, all client-side with no upload.

**Highlights demonstrated in the samples:**

- Client-side FFmpeg WASM singleton with multi-format conversion
- Waveform editor orchestration with peaks.js (non-React instance managed via refs)
- Custom spatially-scoped event hook (`useEventInBounds`)
- Trim/zoom/scroll UI components synchronized to waveform state imperatively

### [`workout-tracker/`](./workout-tracker): Next.js 16 (App Router) + TypeScript + PWA

A mobile-first PWA for tracking strength workouts: per-exercise sets/reps/rest, weight history, video demos, and offline support.

**Highlights demonstrated in the samples:**

- Next.js App Router with client components and local state
- Mobile-first interaction: custom swipe hook, gesture-aware video player
- PWA install + update flow via service worker
- shadcn/ui + Tailwind composition patterns

## File index

| File                                              | Lines | What it shows                                             |
| ------------------------------------------------- | ----- | --------------------------------------------------------- |
| `track-tagger/src/lib/metadataService.ts`         | 565   | FFmpeg + music-metadata orchestration; batched ZIP export |
| `track-tagger/src/components/SongTable.tsx`       | 959   | Sortable/selectable data table with inline editing        |
| `track-tagger/src/components/MetadataPanel.tsx`   | 748   | Multi-select form with mixed-value handling               |
| `track-tagger/src/components/AlbumArtwork.tsx`    | 240   | Drag-drop image upload + resize pipeline                  |
| `track-tagger/src/hooks/useMetadataEditor.ts`     | 263   | Custom hook encapsulating write/progress/error state      |
| `track-tagger/src/store/songStore.ts`             | 192   | Zustand store design                                      |
| `wavetrimmer/src/components/PeakPlayer/PeakPlayer.js`       | 551 | Waveform editor: FFmpeg WASM, trim, normalize, export  |
| `wavetrimmer/src/components/PeakPlayer/TrimSlider.js`       | 114 | Dual-handle trim range synced to waveform time         |
| `wavetrimmer/src/components/PeakPlayer/ZoomViewContainer.js`| 165 | Waveform zoom view with peaks.js                       |
| `wavetrimmer/src/components/PeakPlayer/WaveScrollbar.js`    | 124 | Custom scrollbar for waveform navigation               |
| `wavetrimmer/src/lib/load-ffmpeg.js`                        | 25  | FFmpeg WASM singleton loader                           |
| `wavetrimmer/src/lib/convert.js`                            | 63  | Format-conversion dispatcher                           |
| `wavetrimmer/src/lib/hooks/useEventInBounds.js`             | 53  | Spatially-scoped DOM event hook                        |
| `workout-tracker/src/app/page.tsx`                | 287   | App Router page with workout state + history              |
| `workout-tracker/src/components/workout-card.tsx` | 229   | Interactive exercise card with dialogs                    |
| `workout-tracker/src/components/video-player.tsx` | 165   | Custom HTML5 video controls                               |
| `workout-tracker/src/components/pwa-updater.tsx`  | 65    | Service worker update prompt                              |
| `workout-tracker/src/hooks/use-swipe.ts`          | 34    | Concise touch-gesture utility                             |

## Notes

- Imports like `@/components/ui/*` resolve to shadcn/ui primitives in the original projects; those primitives are stock and not included here.
- Files are presented as-is from the originating projects (no rewriting for the sample), aside from removing files that would have leaked environment-specific config.
