# wavetrimmer

A browser-based audio editor. Load any audio file, trim it to an exact range using a waveform timeline, normalize loudness, convert to a different format, and optionally prepend/append intro and outro clips, all client-side with no upload, powered by FFmpeg compiled to WebAssembly.

**Stack:** Next.js 16 (App Router) · React 19 · JavaScript · Tailwind CSS · peaks.js · `@ffmpeg/ffmpeg` (WASM) · Zustand · Supabase (auth + storage)

**Note on TypeScript:** This codebase is plain JavaScript. It predates the decision to migrate to TS and hasn't been converted. The patterns (custom hooks, singleton services, component decomposition) translate directly to TypeScript.

## Why this is interesting

The hard part of an in-browser audio editor isn't the FFmpeg calls, it's managing the state machine around them: waveform loading is async and multi-step, playback must stay in sync with a non-React peaks.js instance, the trim range must update without re-rendering the waveform, and user input (keyboard shortcuts, scroll wheel zoom) needs to be scoped so it doesn't fire when the user is interacting with other parts of the page. The `PeakPlayer` component and its supporting hooks are where that complexity lives.

## File map

```
src/
├── components/
│   └── PeakPlayer/
│       ├── PeakPlayer.js          # Orchestrates waveform, playback, trim, export
│       ├── TrimSlider.js          # Dual-handle range input synced to waveform time
│       ├── ZoomViewContainer.js   # Waveform zoom view with peaks.js integration
│       └── WaveScrollbar.js       # Custom scrollbar for waveform navigation
└── lib/
    ├── load-ffmpeg.js             # Singleton WASM loader
    ├── convert.js                 # FFmpeg format-conversion dispatcher
    └── hooks/
        └── useEventInBounds.js    # Spatially-scoped DOM event hook
```

## Design notes

- **FFmpeg singleton** (`load-ffmpeg.js`): FFmpeg WASM is expensive to initialize. The module holds a single instance and returns it on subsequent calls, so every consumer gets the same loaded instance without coordinating initialization themselves.

- **`PeakPlayer` state machine**: The component manages a multi-phase lifecycle: idle, loading audio buffer, initializing peaks.js, ready, trimming, exporting. A `PLAYER_STATE` enum drives which controls are enabled. peaks.js is held in a ref (not state) because it manages its own rendering -- React state updates would cause unnecessary re-initializations.

- **`TrimSlider` sync**: The slider drives `[startTime, endTime]` state, but peaks.js segments are updated imperatively via `peaksInstance.segments.removeAll()` and `add()`. The two representations are kept in sync through callbacks rather than a shared store.

- **`useEventInBounds`** solves a specific problem: keyboard events (spacebar to play/pause, arrow keys to scrub) and scroll-wheel zoom should only fire when the user's mouse is inside the waveform container, not globally. The hook tracks hover state with mouseenter/mouseleave refs and gates the handler accordingly.

- **`convert.js`**: Builds the right `ffmpeg_cmd` array for each target format (mp3, wav, ogg, flac, etc.) and runs it via the shared FFmpeg instance. Keeping format logic out of the component makes it easy to add new formats without touching the UI.

## Not included in this sample

- shadcn/ui-style UI primitives under `@/components/ui/*`
- Supabase auth wiring and premium gating
- peaks.js CSS modules and icon components
- Next.js config, middleware, API routes
