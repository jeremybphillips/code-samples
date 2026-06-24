# track-tagger

A browser-based audio metadata (ID3 tag) editor. Drag in audio files, edit tags individually or in bulk, and download re-tagged files entirely client-side via FFmpeg compiled to WebAssembly. No uploads, no server, no account.

Live at [audiotagger.io](https://audiotagger.io)

**Stack:** React 18 · Vite · TypeScript · Zustand · Tailwind · shadcn/ui · `@ffmpeg/ffmpeg` (WASM) · `music-metadata` · JSZip

## Why this is interesting

Editing ID3 tags in the browser without a server is non-trivial: you have to load FFmpeg WASM once, persist a single FFmpeg instance across calls, marshal files in and out of its virtual filesystem, parse existing metadata, write the updated file, and stream the result back to the user. Doing it for a whole batch with consistent UI state (per-row progress, mixed-value detection when multiple songs are selected, optimistic edits before commit) was the bulk of the engineering.

## File map

```
src/
├── components/
│   ├── SongTable.tsx        # The main grid: drag-drop, selection, sort, inline edit
│   ├── MetadataPanel.tsx    # Right-rail form for editing one or many selected songs
│   └── AlbumArtwork.tsx     # Artwork drop-zone with resize-to-1400² pipeline
├── hooks/
│   └── useMetadataEditor.ts # Hook wrapping write/progress/error state
├── lib/
│   └── metadataService.ts   # FFmpeg + music-metadata orchestration
└── store/
    └── songStore.ts         # Zustand store with pending-edit Map
```

## Design notes

- **`metadataService` is a singleton** that lazy-loads FFmpeg core/wasm on first use, then reuses the instance. Each tag write copies the file into FFmpeg's MEMFS, runs the metadata mux, reads back, and cleans up.
- **`songStore`** keeps committed song data and a `Map<songId, MetadataEdit>` of pending edits separately, so the UI can show "dirty" state and the panel can edit multiple songs at once without losing per-row changes.
- **`MetadataPanel`** detects mixed values across selected songs (e.g. two songs with different artists shows a placeholder rather than overwriting one), which is the kind of detail that makes batch editing feel right.
- **`useMetadataEditor`** isolates the write/progress/error lifecycle so components stay declarative.

## Not included in this sample

- The shadcn/ui primitives under `@/components/ui/*`
- Static marketing pages (About, FAQ, Privacy, Terms, etc.)
- Supabase wiring for the contact form (env-config dependent)
- Build config (Vite, Tailwind, TS configs)
- Tests
