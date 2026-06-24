import { useState, useCallback } from "react";
import { metadataService, type MetadataUpdate } from "@/lib/metadataService";
import { type Song } from "@/components/SongTable";

type UseMetadataEditorState = {
  isWriting: boolean;
  writeProgress: number;
  error: string | null;
};

type UseMetadataEditorActions = {
  updateSongMetadata: (
    song: Song,
    updates: MetadataUpdate,
    artworkData?: string
  ) => Promise<Song | null>;
  batchUpdateMetadata: (
    songs: Song[],
    updates: MetadataUpdate[],
    artworkData?: string
  ) => Promise<Song[]>;
  clearError: () => void;
};

/**
 * Hook for managing metadata editing operations
 * Handles both single song and batch metadata updates
 */
export function useMetadataEditor(): UseMetadataEditorState &
  UseMetadataEditorActions {
  const [isWriting, setIsWriting] = useState(false);
  const [writeProgress, setWriteProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update metadata for a single song
   * Returns the updated song with new file, or null if failed
   */
  const updateSongMetadata = useCallback(
    async (
      song: Song,
      updates: MetadataUpdate,
      artworkData?: string
    ): Promise<Song | null> => {
      if (!song.file) {
        setError("No file available for metadata update");
        return null;
      }

      setIsWriting(true);
      setError(null);
      setWriteProgress(0);

      try {
        // Initialize FFmpeg if not already done
        if (!metadataService.isReady()) {
          await metadataService.initializeFFmpeg((progress) => {
            setWriteProgress(Math.min(progress * 0.3, 30)); // FFmpeg loading is 30% of progress
          });
        }

        // Update progress to show we're processing the file
        setWriteProgress(40);

        // Write metadata using FFmpeg
        const updatedFile = await metadataService.writeMetadata(
          song.file,
          updates,
          (progress) => {
            setWriteProgress(40 + progress * 0.6); // File processing is 60% of remaining progress
          },
          artworkData
        );

        setWriteProgress(100);

        // Create updated song object
        const updatedSong: Song = {
          ...song,
          title: updates.title || song.title,
          artist: updates.artist || song.artist,
          album: updates.album || song.album,
          year: updates.year || song.year,
          trackNumber: updates.trackNumber || song.trackNumber,
          file: updatedFile,
        };

        return updatedSong;
      } catch (error) {
        console.error("Failed to update metadata:", error);
        setError(
          error instanceof Error ? error.message : "Failed to update metadata"
        );
        return null;
      } finally {
        setIsWriting(false);
        setWriteProgress(0);
      }
    },
    []
  );

  /**
   * Update metadata for multiple songs in batch
   * Processes songs sequentially to manage memory usage
   */
  const batchUpdateMetadata = useCallback(
    async (
      songs: Song[],
      updates: MetadataUpdate[],
      artworkData?: string
    ): Promise<Song[]> => {
      if (songs.length !== updates.length) {
        setError("Number of songs must match number of update objects");
        return songs;
      }

      setIsWriting(true);
      setError(null);
      setWriteProgress(0);

      const updatedSongs: Song[] = [];
      const errors: string[] = [];

      try {
        // Initialize FFmpeg once for batch operations
        if (!metadataService.isReady()) {
          await metadataService.initializeFFmpeg();
        }

        // Process files sequentially to manage memory
        for (let i = 0; i < songs.length; i++) {
          const song = songs[i];
          const update = updates[i];

          // Update overall progress
          const overallProgress = (i / songs.length) * 100;
          setWriteProgress(overallProgress);

          try {
            if (!song.file) {
              console.warn(`No file available for song: ${song.title}`);
              updatedSongs.push(song); // Keep original
              continue;
            }

            // Write metadata for current song
            const updatedFile = await metadataService.writeMetadata(
              song.file,
              update,
              undefined, // No individual progress callback for batch
              artworkData
            );

            // Create updated song object
            const updatedSong: Song = {
              ...song,
              title: update.title || song.title,
              artist: update.artist || song.artist,
              album: update.album || song.album,
              year: update.year || song.year,
              trackNumber: update.trackNumber || song.trackNumber,
              file: updatedFile,
            };

            updatedSongs.push(updatedSong);
          } catch (error) {
            console.error(
              `Failed to update metadata for ${song.title}:`,
              error
            );
            errors.push(
              `${song.title}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
            updatedSongs.push(song); // Keep original on error
          }
        }

        setWriteProgress(100);

        // Set error if any files failed
        if (errors.length > 0) {
          setError(`Some files failed to update: ${errors.join(", ")}`);
        }

        return updatedSongs;
      } catch (error) {
        console.error("Batch metadata update failed:", error);
        setError(
          error instanceof Error ? error.message : "Batch update failed"
        );
        return songs; // Return original songs on complete failure
      } finally {
        setIsWriting(false);
        setWriteProgress(0);
      }
    },
    []
  );

  /**
   * Clear any current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isWriting,
    writeProgress,
    error,
    updateSongMetadata,
    batchUpdateMetadata,
    clearError,
  };
}

/*
USAGE EXAMPLES:

// Single song update
const { updateSongMetadata, isWriting, writeProgress, error } = useMetadataEditor();

const handleUpdateSong = async (song: Song) => {
  const updates: MetadataUpdate = {
    title: "New Title",
    artist: "New Artist",
    album: "New Album"
  };

  const updatedSong = await updateSongMetadata(song, updates);
  if (updatedSong) {
    // Update your song list with the new song
    setSongs(prev => prev.map(s => s.id === song.id ? updatedSong : s));
  }
};

// Batch update
const handleBatchUpdate = async (selectedSongs: Song[]) => {
  const updates = selectedSongs.map(song => ({
    album: "Same Album for All",
    year: "2024"
  }));

  const updatedSongs = await batchUpdateMetadata(selectedSongs, updates);
  // Update your song list
  setSongs(prev => {
    const updatedMap = new Map(updatedSongs.map(s => [s.id, s]));
    return prev.map(song => updatedMap.get(song.id) || song);
  });
};

BEST PRACTICES:

1. Always check if song.file exists before calling update functions
2. Handle errors gracefully and inform users of any failures
3. Show progress indicators for long operations
4. Use batch operations for multiple files to optimize performance
5. Consider implementing an undo feature by keeping original files
6. Monitor memory usage when processing many large files
*/
