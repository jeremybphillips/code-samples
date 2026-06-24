import { create } from "zustand";
import { Song } from "@/components/SongTable";

type MetadataEdit = {
  tags?: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  trackNumber?: string;
  discNumber?: string;
  totalTracks?: string;
  totalDiscs?: string;
  compilation?: boolean;
};

type SongStore = {
  // Core song data
  songs: Song[];
  selectedSongIds: string[];

  // Pending edits by song ID
  pendingEdits: Map<string, MetadataEdit>;

  // Artwork data
  artworkData: string | null;
  artworkFile: File | null;
  artworkChanged: boolean; // Track if artwork has changed since last save

  // Actions
  setSongs: (songs: Song[]) => void;
  addSongs: (newSongs: Song[]) => void;
  updateSong: (songId: string, updates: Partial<Song>) => void;
  removeSong: (songId: string) => void;
  setSelectedSongs: (songIds: string[]) => void;

  // Pending edits actions
  setPendingEdit: (
    songId: string,
    field: keyof MetadataEdit,
    value: string | boolean
  ) => void;
  setPendingEditsForSongs: (
    songIds: string[],
    field: keyof MetadataEdit,
    value: string | boolean
  ) => void;
  clearPendingEdits: (songIds: string[]) => void;
  getPendingEditsCount: () => number;
  getSongWithEdits: (songId: string) => Song | undefined;

  // Artwork actions
  setArtwork: (imageData: string | null, file: File | null) => void;
  clearArtworkChanged: () => void;

  // Reset action
  resetAll: () => void;
};

export const useSongStore = create<SongStore>((set, get) => ({
  // Initial state
  songs: [],
  selectedSongIds: [],
  pendingEdits: new Map(),
  artworkData: null,
  artworkFile: null,
  artworkChanged: false,

  // Core song actions
  setSongs: (songs) => set({ songs }),

  addSongs: (newSongs) =>
    set((state) => ({
      songs: [...state.songs, ...newSongs],
    })),

  updateSong: (songId, updates) =>
    set((state) => ({
      songs: state.songs.map((song) =>
        song.id === songId ? { ...song, ...updates } : song
      ),
    })),

  removeSong: (songId) =>
    set((state) => {
      // Remove the song from songs array
      const newSongs = state.songs.filter((song) => song.id !== songId);

      // Remove from selected songs if it was selected
      const newSelectedSongIds = state.selectedSongIds.filter(
        (id) => id !== songId
      );

      // Remove any pending edits for this song
      const newPendingEdits = new Map(state.pendingEdits);
      newPendingEdits.delete(songId);

      return {
        songs: newSongs,
        selectedSongIds: newSelectedSongIds,
        pendingEdits: newPendingEdits,
      };
    }),

  setSelectedSongs: (songIds) => set({ selectedSongIds: songIds }),

  // Pending edits actions
  setPendingEdit: (songId, field, value) =>
    set((state) => {
      const newPendingEdits = new Map(state.pendingEdits);
      const existingEdits = newPendingEdits.get(songId) || {};
      newPendingEdits.set(songId, {
        ...existingEdits,
        [field]: value,
      });
      return { pendingEdits: newPendingEdits };
    }),

  setPendingEditsForSongs: (songIds, field, value) =>
    set((state) => {
      const newPendingEdits = new Map(state.pendingEdits);
      songIds.forEach((songId) => {
        const existingEdits = newPendingEdits.get(songId) || {};
        newPendingEdits.set(songId, {
          ...existingEdits,
          [field]: value,
        });
      });
      return { pendingEdits: newPendingEdits };
    }),

  clearPendingEdits: (songIds) =>
    set((state) => {
      const newPendingEdits = new Map(state.pendingEdits);
      songIds.forEach((songId) => {
        newPendingEdits.delete(songId);
      });
      return { pendingEdits: newPendingEdits };
    }),

  getPendingEditsCount: () => {
    return get().pendingEdits.size;
  },

  getSongWithEdits: (songId) => {
    const state = get();
    const song = state.songs.find((s) => s.id === songId);
    if (!song) return undefined;

    const edits = state.pendingEdits.get(songId);
    if (!edits) return song;

    // Apply pending edits to create a virtual song with live updates
    return {
      ...song,
      title: edits.title !== undefined ? edits.title : song.title,
      artist: edits.artist !== undefined ? edits.artist : song.artist,
      album: edits.album !== undefined ? edits.album : song.album,
      year: edits.year !== undefined ? edits.year : song.year,
      trackNumber:
        edits.trackNumber !== undefined ? edits.trackNumber : song.trackNumber,
      totalTracks:
        edits.totalTracks !== undefined ? edits.totalTracks : song.totalTracks,
      discNumber:
        edits.discNumber !== undefined ? edits.discNumber : song.discNumber,
      totalDiscs:
        edits.totalDiscs !== undefined ? edits.totalDiscs : song.totalDiscs,
    };
  },

  // Artwork actions
  setArtwork: (imageData, file) =>
    set({
      artworkData: imageData,
      artworkFile: file,
      artworkChanged: true,
    }),

  clearArtworkChanged: () => set({ artworkChanged: false }),

  // Reset action
  resetAll: () =>
    set({
      songs: [],
      selectedSongIds: [],
      pendingEdits: new Map(),
      artworkData: null,
      artworkFile: null,
      artworkChanged: false,
    }),
}));
