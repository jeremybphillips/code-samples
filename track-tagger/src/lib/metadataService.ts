import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { parseBlob } from "music-metadata";
import JSZip from "jszip";

export type MetadataUpdate = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  trackNumber?: string;
  totalTracks?: string;
  discNumber?: string;
  totalDiscs?: string;
  genre?: string;
  artwork?: string; // Base64 encoded image data
};

export type AudioMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  trackNumber?: string;
  totalTracks?: string;
  discNumber?: string;
  totalDiscs?: string;
  genre?: string;
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  format?: string;
  picture?: string; // Base64 data URL for embedded album artwork
};

class MetadataService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;

  /**
   * Check if FFmpeg is ready for use
   */
  isReady(): boolean {
    return this.isLoaded && this.ffmpeg !== null;
  }

  /**
   * Force cleanup of FFmpeg instance to free memory
   */
  async cleanup(): Promise<void> {
    if (this.ffmpeg) {
      try {
        // Terminate the FFmpeg instance to free memory
        await this.ffmpeg.terminate();
      } catch (error) {
        console.warn("Error terminating FFmpeg:", error);
      }
      this.ffmpeg = null;
      this.isLoaded = false;
    }
  }

  async initializeFFmpeg(
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (this.isLoaded && this.ffmpeg) {
      return;
    }

    try {
      // Check for SharedArrayBuffer support
      if (typeof SharedArrayBuffer === "undefined") {
        console.warn(
          "SharedArrayBuffer is not available. FFmpeg will not work."
        );
        return;
      }

      onProgress?.(5);

      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on("progress", ({ progress }) => {
        const currentProgress = Math.min(90, 10 + progress * 80);
        onProgress?.(currentProgress);
      });

      onProgress?.(20);

      let ffmpegLoaded = false;
      let lastError = null;
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

      try {
        await this.ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
        });

        ffmpegLoaded = true;
      } catch (error) {
        console.warn(`Failed to load ffmpeg:`);
        lastError = error;
      }

      if (!ffmpegLoaded) {
        throw (
          lastError || new Error("Failed to load FFmpeg from all CDN sources")
        );
      }

      this.isLoaded = true;
      onProgress?.(100);
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      this.ffmpeg = null;
      this.isLoaded = false;

      if (onProgress) {
        onProgress(100);
      }
    }
  }

  async readMetadata(file: File): Promise<AudioMetadata> {
    try {
      const metadata = await parseBlob(file);

      // Extract picture if available
      let picture: string | undefined;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        const base64 = btoa(
          new Uint8Array(pic.data).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );
        picture = `data:${pic.format};base64,${base64}`;
      }

      return {
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        albumArtist: metadata.common.albumartist,
        year: metadata.common.year?.toString(),
        trackNumber: metadata.common.track?.no?.toString(),
        totalTracks: metadata.common.track?.of?.toString(),
        discNumber: metadata.common.disk?.no?.toString(),
        totalDiscs: metadata.common.disk?.of?.toString(),
        genre: metadata.common.genre?.[0],
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        format: metadata.format.container,
        picture,
      };
    } catch (error) {
      console.error("Error reading metadata:", error);
      return {};
    }
  }

  async writeMetadata(
    file: File,
    updates: MetadataUpdate,
    onProgress?: (progress: number) => void,
    artworkData?: string
  ): Promise<File> {
    if (!this.isLoaded) {
      await this.initializeFFmpeg(onProgress);
    }

    if (!this.ffmpeg) {
      // Fallback mode - just return the original file with a warning
      console.warn(
        "FFmpeg not available. Returning original file. Metadata changes are displayed in UI only."
      );
      onProgress?.(100);

      // Simulate processing time for UI consistency
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return file;
    }

    // Declare file names at function scope so they're accessible in catch block
    let inputFileName = "";
    let outputFileName = "";
    let artworkFileName: string | undefined;

    try {
      onProgress?.(10);

      // Check file size to avoid memory issues
      const maxFileSize = 100 * 1024 * 1024; // 100MB limit
      if (file.size > maxFileSize) {
        throw new Error(
          `File size (${Math.round(
            file.size / 1024 / 1024
          )}MB) exceeds limit of ${Math.round(maxFileSize / 1024 / 1024)}MB`
        );
      }

      // Write input file to FFmpeg's virtual file system
      inputFileName = `input_${Date.now()}.${this.getFileExtension(file.name)}`;
      outputFileName = `output_${Date.now()}.${this.getFileExtension(
        file.name
      )}`;

      await this.ffmpeg.writeFile(inputFileName, await fetchFile(file));
      onProgress?.(20);

      // Handle artwork if provided
      if (artworkData) {
        try {
          artworkFileName = `artwork_${Date.now()}.jpg`;

          // Convert base64 data URL to blob
          const response = await fetch(artworkData);
          const blob = await response.blob();

          // Check artwork size and reject if too large
          const maxArtworkSize = 2 * 1024 * 1024; // 2MB limit

          if (blob.size > maxArtworkSize) {
            const sizeMB = Math.round(blob.size / 1024 / 1024);
            const limitMB = Math.round(maxArtworkSize / 1024 / 1024);
            throw new Error(
              `Artwork file size (${sizeMB}MB) exceeds the ${limitMB}MB limit. Please use a smaller image file.`
            );
          }

          // Write artwork to FFmpeg filesystem
          await this.ffmpeg.writeFile(artworkFileName, await fetchFile(blob));
          onProgress?.(25);
        } catch (error) {
          console.warn("Failed to process artwork:", error);
          // Re-throw the error to stop processing instead of continuing without artwork
          throw new Error(
            `Failed to process artwork: ${error.message || error}`
          );
        }
      }

      onProgress?.(30);

      // Read existing metadata to preserve values not being updated
      let existingMetadata: AudioMetadata = {};
      try {
        existingMetadata = await this.readMetadata(file);
      } catch (error) {
        console.warn("Failed to read existing metadata:", error);
      }

      // Merge existing metadata with updates, preserving existing values for track/disc combinations
      const mergedUpdates = { ...updates };

      // Special handling for track metadata - preserve existing track number if only updating total tracks
      if (
        updates.totalTracks !== undefined &&
        updates.trackNumber === undefined
      ) {
        if (existingMetadata.trackNumber) {
          mergedUpdates.trackNumber = existingMetadata.trackNumber;
        }
      }

      // Special handling for disc metadata - preserve existing disc number if only updating total discs
      if (
        updates.totalDiscs !== undefined &&
        updates.discNumber === undefined
      ) {
        if (existingMetadata.discNumber) {
          mergedUpdates.discNumber = existingMetadata.discNumber;
        }
      }

      // Build FFmpeg command for metadata writing
      const ffmpegArgs = this.buildMetadataCommand(
        inputFileName,
        outputFileName,
        mergedUpdates,
        artworkFileName
      );

      onProgress?.(40);

      // Execute FFmpeg command
      try {
        await this.ffmpeg.exec(ffmpegArgs);
      } catch (execError) {
        console.error("FFmpeg exec error:", execError);

        // If there's an artwork file involved and we get any error,
        // assume it might be artwork-related and provide helpful message
        if (artworkFileName) {
          throw new Error(
            `Failed to process audio file with artwork. This may be due to artwork file format or size issues. Please try with a smaller JPEG image (under 2MB).`
          );
        } else {
          // Re-throw the original error for non-artwork related issues
          throw execError;
        }
      }
      onProgress?.(80);

      // Clean up artwork file if it was created
      if (artworkFileName) {
        try {
          await this.ffmpeg.deleteFile(artworkFileName);
        } catch (error) {
          console.warn("Failed to cleanup artwork file:", error);
        }
      }

      // Read the output file
      const outputData = await this.ffmpeg.readFile(outputFileName);
      onProgress?.(90);

      // Create a new File object with the processed data
      // Convert FFmpeg FileData to a regular Uint8Array for browser compatibility
      const outputBuffer =
        outputData instanceof Uint8Array
          ? outputData.slice()
          : new Uint8Array(outputData as unknown as ArrayBuffer);

      const processedFile = new File([outputBuffer], file.name, {
        type: file.type,
        lastModified: Date.now(),
      });

      onProgress?.(100);

      // Clean up temporary files
      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary files:", cleanupError);
      }

      return processedFile;
    } catch (error) {
      console.error("Error writing metadata with FFmpeg:", error);
      onProgress?.(100);

      // If we hit a memory error, try to cleanup FFmpeg instance
      if (
        error.message?.includes("memory") ||
        error.message?.includes("out of bounds")
      ) {
        console.warn("Memory error detected, cleaning up FFmpeg instance");
        try {
          // Clean up any remaining files first
          if (this.ffmpeg) {
            try {
              await this.ffmpeg.deleteFile(inputFileName);
            } catch (e) {
              /* ignore */
            }
            try {
              await this.ffmpeg.deleteFile(outputFileName);
            } catch (e) {
              /* ignore */
            }
            if (artworkFileName) {
              try {
                await this.ffmpeg.deleteFile(artworkFileName);
              } catch (e) {
                /* ignore */
              }
            }
          }

          // Force cleanup of FFmpeg instance
          await this.cleanup();
        } catch (cleanupError) {
          console.warn(
            "Failed to cleanup FFmpeg after memory error:",
            cleanupError
          );
        }
      }

      // Return original file if processing fails
      return file;
    }
  }

  /**
   * Build FFmpeg command arguments for writing metadata
   */
  private buildMetadataCommand(
    inputFileName: string,
    outputFileName: string,
    updates: MetadataUpdate,
    artworkFileName?: string
  ): string[] {
    const args = ["-i", inputFileName];

    // Add artwork as second input if provided
    if (artworkFileName) {
      args.push("-i", artworkFileName);
    }

    // Add metadata arguments
    if (updates.title) {
      args.push("-metadata", `title=${updates.title}`);
    }
    if (updates.artist) {
      args.push("-metadata", `artist=${updates.artist}`);
    }
    if (updates.album) {
      args.push("-metadata", `album=${updates.album}`);
    }
    if (updates.year) {
      args.push("-metadata", `date=${updates.year}`);
    }
    if (updates.trackNumber || updates.totalTracks) {
      // Handle track number and total tracks together
      let trackValue = "";

      if (updates.trackNumber && updates.totalTracks) {
        // Both track number and total tracks provided
        trackValue = `${updates.trackNumber}/${updates.totalTracks}`;
      } else if (updates.trackNumber) {
        // Only track number provided
        trackValue = updates.trackNumber;
      } else if (updates.totalTracks) {
        // Only total tracks provided, use format "0/total"
        trackValue = `0/${updates.totalTracks}`;
      }

      if (trackValue) {
        args.push("-metadata", `track=${trackValue}`);
      }
    }
    if (updates.albumArtist) {
      args.push("-metadata", `album_artist=${updates.albumArtist}`);
    }
    if (updates.discNumber || updates.totalDiscs) {
      // Handle disc number and total discs together
      let discValue = "";

      if (updates.discNumber && updates.totalDiscs) {
        // Both disc number and total discs provided
        discValue = `${updates.discNumber}/${updates.totalDiscs}`;
      } else if (updates.discNumber) {
        // Only disc number provided
        discValue = updates.discNumber;
      } else if (updates.totalDiscs) {
        // Only total discs provided, use format "0/total"
        discValue = `0/${updates.totalDiscs}`;
      }

      if (discValue) {
        args.push("-metadata", `disc=${discValue}`);
      }
    }
    if (updates.genre) {
      args.push("-metadata", `genre=${updates.genre}`);
    }

    // Copy audio stream without re-encoding
    args.push("-c:a", "copy");

    // Handle artwork
    if (artworkFileName) {
      // Map the artwork as cover art with more conservative scaling
      args.push(
        "-map",
        "0:a", // Map audio from first input
        "-map",
        "1:v", // Map video (artwork) from second input
        "-c:v",
        "mjpeg", // Encode artwork as JPEG
        "-vf",
        "scale='min(800,iw)':'min(800,ih)':force_original_aspect_ratio=decrease", // More conservative scaling to 800x800 max
        "-disposition:v",
        "attached_pic" // Mark as attached picture
      );
    }
    // Note: We don't add "-c copy" when no artwork because it would override our metadata changes

    // Overwrite output file if it exists
    args.push("-y");

    // Output file
    args.push(outputFileName);

    return args;
  }

  /**
   * Trigger download of a file - now public so users can download when ready
   */
  downloadFile(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up the URL object after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Download multiple files as a batch
   */
  downloadFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    // If only one file, download directly
    if (files.length === 1) {
      this.downloadFile(files[0]);
      return;
    }

    // Create a ZIP archive for multiple files
    const zip = new JSZip();
    files.forEach((file) => {
      zip.file(file.name, file);
    });

    zip
      .generateAsync({ type: "blob" })
      .then((content) => {
        const zipFile = new File([content], "audiotagger_edited_songs.zip", {
          type: "application/zip",
          lastModified: Date.now(),
        });
        this.downloadFile(zipFile);
      })
      .catch((error) => {
        console.error("Failed to create ZIP archive:", error);
      });
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : "mp3";
  }
}

export const metadataService = new MetadataService();
