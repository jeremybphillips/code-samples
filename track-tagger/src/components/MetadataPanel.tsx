import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { type Song } from "@/components/SongTable";
import { useMetadataEditor } from "@/hooks/useMetadataEditor";
import { metadataService } from "@/lib/metadataService";
import { useSongStore } from "@/store/songStore";
import { Loader2, Save, AlertCircle, Download } from "lucide-react";
import { track } from "@vercel/analytics";

type MetadataFields = {
  tags: string;
  artist: string;
  title: string;
  album: string;
  albumArtist: string;
  year: string;
  trackNumber: string;
  totalTracks: string;
  discNumber: string;
  totalDiscs: string;
  compilation: boolean;
};

type MetadataPanelProps = {
  selectedSongs: Song[];
  onSongsUpdated?: (updatedSongs: Song[]) => void;
  artworkData?: string | null;
  artworkFile?: File | null;
};

// Move MetadataField outside to prevent recreation on each render
const MetadataField = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
  min,
  max,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: "text" | "number";
  min?: string;
  max?: string;
  maxLength?: number;
}) => (
  <div className="flex items-center py-2">
    <div className="w-24 flex-shrink-0">
      <Label className="text-metadata-label text-xs font-normal">{label}</Label>
    </div>
    <div className="flex-1">
      <Input
        type={type}
        min={min}
        max={max}
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          const inputValue = e.target.value;
          if (type === "number") {
            // Check maxLength for number inputs (since maxLength doesn't work on type="number")
            if (maxLength && inputValue.length > maxLength) {
              return;
            }
            if (inputValue === "" || /^\d+$/.test(inputValue)) {
              onChange(inputValue);
            }
          } else {
            onChange(inputValue);
          }
        }}
        className={cn(
          "h-8 bg-input border-0 text-metadata-value text-sm px-2",
          "focus:ring-1 focus:ring-primary",
          type === "number" &&
            "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
        style={type === "number" ? { MozAppearance: "textfield" } : undefined}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  </div>
);

export const MetadataPanel = ({
  selectedSongs,
  onSongsUpdated,
  artworkData,
  artworkFile,
}: MetadataPanelProps) => {
  const [metadata, setMetadata] = useState<MetadataFields>({
    tags: "",
    artist: "",
    title: "",
    album: "",
    albumArtist: "",
    year: "",
    trackNumber: "",
    totalTracks: "",
    discNumber: "",
    totalDiscs: "",
    compilation: false,
  });

  //console.log("Rendering MetadataPanel with selectedSongs:", selectedSongs);

  const [hasChanges, setHasChanges] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<File[]>([]);

  // Use the song store for pending edits
  const {
    songs,
    pendingEdits,
    artworkChanged,
    setPendingEdit,
    clearPendingEdits,
    clearArtworkChanged,
  } = useSongStore();

  // Use the metadata editor hook
  const { updateSongMetadata, isWriting, writeProgress, error, clearError } =
    useMetadataEditor();

  // Create a stable dependency from selected song IDs
  const selectedSongIds = useMemo(
    () =>
      selectedSongs
        .map((song) => song.id)
        .sort()
        .join(","),
    [selectedSongs]
  );

  useEffect(() => {
    if (selectedSongs.length === 0) {
      setMetadata({
        tags: "",
        artist: "",
        title: "",
        album: "",
        albumArtist: "",
        year: "",
        trackNumber: "",
        totalTracks: "",
        discNumber: "",
        totalDiscs: "",
        compilation: false,
      });
      setHasChanges(false);
      clearError();
      return;
    }

    const getFieldValue = (field: keyof Song) => {
      const values = selectedSongs.map((song) => {
        // Check if there are pending edits for this song
        const songEdits = pendingEdits.get(song.id);
        const editedValue = songEdits?.[field as keyof MetadataFields];

        // Use edited value if available, otherwise use original song value
        return editedValue !== undefined ? editedValue : song[field];
      });
      const uniqueValues = [...new Set(values)];
      return uniqueValues.length === 1 ? String(values[0]) : "Mixed";
    };

    const getMetadataOnlyFieldValue = (field: keyof MetadataFields) => {
      const values = selectedSongs.map((song) => {
        const songEdits = pendingEdits.get(song.id);
        const editedValue = songEdits?.[field];

        // If there's a pending edit, use it; otherwise check the song's metadata
        if (editedValue !== undefined) {
          return editedValue;
        }

        // Check song object first, then fall back to metadata
        // Use !== undefined to handle empty strings correctly
        switch (field) {
          case "totalTracks":
            return song.totalTracks !== undefined
              ? song.totalTracks
              : song.metadata?.totalTracks;
          case "discNumber":
            return song.discNumber !== undefined
              ? song.discNumber
              : song.metadata?.discNumber;
          case "totalDiscs":
            return song.totalDiscs !== undefined
              ? song.totalDiscs
              : song.metadata?.totalDiscs;
          default:
            return undefined;
        }
      });

      const definedValues = values.filter((v) => v !== undefined);
      const uniqueValues = [...new Set(definedValues)];

      if (definedValues.length === 0) {
        return "";
      }

      return uniqueValues.length === 1 ? String(definedValues[0]) : "Mixed";
    };

    const getCompilationValue = () => {
      const values = selectedSongs.map((song) => {
        const songEdits = pendingEdits.get(song.id);
        return songEdits?.compilation;
      });
      const definedValues = values.filter((v) => v !== undefined);
      const uniqueValues = [...new Set(definedValues)];

      if (definedValues.length === 0) {
        return false;
      }

      if (uniqueValues.length === 1) {
        const value = definedValues[0];
        return Boolean(value);
      }
      return false; // Mixed values default to false
    };

    const getEditedTitle = () => {
      if (selectedSongs.length === 1) {
        const song = selectedSongs[0];
        const songEdits = pendingEdits.get(song.id);

        // Check pending edits first, then song data, then metadata
        return songEdits?.title !== undefined
          ? songEdits.title
          : song.title || song.metadata?.title || "Mixed";
      }
      return "Mixed";
    };

    const getEditedTrackNumber = () => {
      if (selectedSongs.length === 1) {
        const song = selectedSongs[0];
        const songEdits = pendingEdits.get(song.id);

        // Check pending edits first, then song data, then metadata
        return songEdits?.trackNumber !== undefined
          ? songEdits.trackNumber
          : song.trackNumber || song.metadata?.trackNumber || "";
      }
      return "";
    };

    const newMetadata = {
      tags: "Standard",
      artist: getFieldValue("artist"),
      title: getEditedTitle(),
      album: getFieldValue("album"),
      albumArtist: getFieldValue("artist"), // Using artist as album artist
      year: getFieldValue("year"),
      trackNumber: getEditedTrackNumber(),
      totalTracks: getMetadataOnlyFieldValue("totalTracks"),
      discNumber: getMetadataOnlyFieldValue("discNumber"),
      totalDiscs: getMetadataOnlyFieldValue("totalDiscs"),
      compilation: getCompilationValue(),
    };

    //console.log("Loaded metadata for selected songs:", newMetadata);

    setMetadata(newMetadata);

    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSongIds]);

  // Reset hasChanges when selection changes (manually managed after this)
  useEffect(() => {
    setHasChanges(false);
  }, [selectedSongIds]);

  useEffect(() => {
    if (songs.length === 0) {
      setProcessedFiles([]);
    }
  }, [songs.length]);

  const handleInputChange = (
    field: keyof MetadataFields,
    value: string | boolean
  ) => {
    setMetadata((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Store pending edits for the currently selected songs
    selectedSongs.forEach((song) => {
      setPendingEdit(song.id, field, value);
    });

    setHasChanges(true);
  };

  /**
   * Save metadata changes to selected songs
   */
  const handleSaveMetadata = async () => {
    if (pendingEdits.size === 0 && !artworkChanged) {
      return;
    }

    // Get all songs that have pending edits OR if only artwork changed, use all songs
    let songsToUpdate: Song[];

    if (pendingEdits.size > 0) {
      // Process songs with pending metadata edits
      songsToUpdate = Array.from(pendingEdits.keys())
        .map((songId) => songs.find((song) => song.id === songId))
        .filter(
          (song): song is Song => song !== undefined && song.file !== undefined
        );
    } else if (artworkChanged) {
      // Only artwork changed, process ALL songs
      songsToUpdate = songs.filter((song) => song.file !== undefined);
    } else {
      songsToUpdate = [];
    }

    if (songsToUpdate.length === 0) {
      console.warn("Cannot save metadata for songs without files");
      return;
    }

    try {
      const updatedSongs: Song[] = [];

      for (const song of songsToUpdate) {
        const songEdits = pendingEdits.get(song.id);

        // If no pending edits but artwork changed, just update artwork
        // If pending edits exist, apply them
        const updates = songEdits
          ? {
              title: songEdits.title != undefined ? songEdits.title : undefined,
              artist:
                songEdits.artist != undefined ? songEdits.artist : undefined,
              album: songEdits.album != undefined ? songEdits.album : undefined,
              albumArtist:
                songEdits.albumArtist != undefined
                  ? songEdits.albumArtist
                  : undefined,
              year:
                songEdits.year != undefined && songEdits.year
                  ? songEdits.year
                  : undefined,
              trackNumber:
                songEdits.trackNumber != undefined
                  ? songEdits.trackNumber
                  : undefined,
              totalTracks:
                songEdits.totalTracks != undefined
                  ? songEdits.totalTracks
                  : undefined,
              discNumber:
                songEdits.discNumber != undefined
                  ? songEdits.discNumber
                  : undefined,
              totalDiscs:
                songEdits.totalDiscs != undefined
                  ? songEdits.totalDiscs
                  : undefined,
            }
          : {}; // Empty updates object if only artwork is changing

        const updatedSong = await updateSongMetadata(
          song,
          updates,
          artworkData || undefined
        );

        if (updatedSong?.file) {
          updatedSongs.push(updatedSong);
          // Add processed file to the list
          setProcessedFiles((prev) => [
            ...prev.filter((f) => f.name !== updatedSong.file!.name),
            updatedSong.file!,
          ]);
        }
      }

      if (updatedSongs.length > 0) {
        onSongsUpdated?.(updatedSongs);

        // Clear pending edits for successfully updated songs
        clearPendingEdits(updatedSongs.map((song) => song.id));

        // Clear artwork changed flag
        clearArtworkChanged();

        setHasChanges(false);
      }
    } catch (error) {
      console.error("Failed to save metadata:", error);
    }
  };

  /**
   * Download all processed files
   */
  const handleDownloadProcessed = () => {
    if (processedFiles.length === 0) {
      return;
    }

    metadataService.downloadFiles(processedFiles);

    // Track download event with Vercel Analytics
    track("songs_downloaded", {
      count: processedFiles.length,
      date: new Date().toISOString().split("T")[0],
    });

    // Optionally clear the processed files list after download
    setProcessedFiles([]);
  };

  return (
    <div className="bg-sidebar border-t border-sidebar-border">
      {/* Error Alert */}
      {error && (
        <div className="px-4 py-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Writing Progress */}
      {isWriting && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span className="text-sm font-medium">Writing metadata...</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${writeProgress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {Math.round(writeProgress)}% complete
          </div>
        </div>
      )}

      {/* Metadata Fields */}
      <div className="px-4 py-2 space-y-1">
        <MetadataField
          label="Title"
          value={metadata.title}
          onChange={(value) => handleInputChange("title", value)}
          disabled={selectedSongs.length === 0 || selectedSongs.length > 1}
          maxLength={255}
        />

        <MetadataField
          label="Artist"
          value={metadata.artist}
          onChange={(value) => handleInputChange("artist", value)}
          disabled={selectedSongs.length === 0}
          maxLength={255}
        />

        <MetadataField
          label="Album"
          value={metadata.album}
          onChange={(value) => handleInputChange("album", value)}
          disabled={selectedSongs.length === 0}
          maxLength={255}
        />

        {/* <MetadataField
          label="Album Artist"
          value={metadata.albumArtist}
          onChange={(value) => handleInputChange("albumArtist", value)}
        /> */}

        <MetadataField
          label="Year"
          type={metadata.year === "Mixed" ? "text" : "number"}
          min="1900"
          max="2100"
          value={metadata.year === "Mixed" ? "" : metadata.year}
          onChange={(value) => handleInputChange("year", value)}
          disabled={selectedSongs.length === 0}
          maxLength={4}
        />

        {/* Track Number */}
        <div className="flex items-center py-2">
          <div className="w-24 flex-shrink-0">
            <Label className="text-metadata-label text-xs font-normal">
              Track
            </Label>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Input
              type={
                metadata.trackNumber === "Mixed" || metadata.trackNumber === ""
                  ? "text"
                  : "number"
              }
              min="1"
              max={
                metadata.totalTracks
                  ? parseInt(metadata.totalTracks) || undefined
                  : undefined
              }
              maxLength={3}
              value={metadata.trackNumber}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d+$/.test(value)) {
                  handleInputChange("trackNumber", value);
                }
              }}
              className={cn(
                "h-8 w-16 bg-input border-0 text-metadata-value text-sm px-2 text-center",
                "focus:ring-1 focus:ring-primary",
                "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              )}
              style={{ MozAppearance: "textfield" }}
              placeholder="--"
              disabled={selectedSongs.length === 0 || selectedSongs.length > 1}
            />
            <span className="text-metadata-label text-xs">of</span>
            <Input
              type={
                metadata.totalTracks === "Mixed" || metadata.totalTracks === ""
                  ? "text"
                  : "number"
              }
              min="1"
              maxLength={3}
              value={metadata.totalTracks}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d+$/.test(value)) {
                  handleInputChange("totalTracks", value);
                }
              }}
              className={cn(
                "h-8 w-16 bg-input border-0 text-metadata-value text-sm px-2 text-center",
                "focus:ring-1 focus:ring-primary",
                "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              )}
              style={{ MozAppearance: "textfield" }}
              placeholder="--"
              disabled={selectedSongs.length === 0}
            />
          </div>
        </div>

        {/* Disc Number */}
        <div className="flex items-center py-2">
          <div className="w-24 flex-shrink-0">
            <Label className="text-metadata-label text-xs font-normal">
              Disc
            </Label>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Input
              type={
                metadata.discNumber === "Mixed" || metadata.discNumber === ""
                  ? "text"
                  : "number"
              }
              min="1"
              max={
                metadata.totalDiscs
                  ? parseInt(metadata.totalDiscs) || undefined
                  : undefined
              }
              maxLength={2}
              value={metadata.discNumber}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d+$/.test(value)) {
                  handleInputChange("discNumber", value);
                }
              }}
              className={cn(
                "h-8 w-16 bg-input border-0 text-metadata-value text-sm px-2 text-center",
                "focus:ring-1 focus:ring-primary",
                "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              )}
              style={{ MozAppearance: "textfield" }}
              placeholder="--"
              disabled={selectedSongs.length === 0 || !metadata.compilation}
            />
            <span className="text-metadata-label text-xs">of</span>
            <Input
              type={
                metadata.totalDiscs === "Mixed" || metadata.totalDiscs === ""
                  ? "text"
                  : "number"
              }
              min="1"
              maxLength={2}
              value={metadata.totalDiscs}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d+$/.test(value)) {
                  handleInputChange("totalDiscs", value);
                }
              }}
              className={cn(
                "h-8 w-16 bg-input border-0 text-metadata-value text-sm px-2 text-center",
                "focus:ring-1 focus:ring-primary",
                "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              )}
              style={{ MozAppearance: "textfield" }}
              placeholder="--"
              disabled={selectedSongs.length === 0 || !metadata.compilation}
            />
          </div>
        </div>

        {/* Compilation Checkbox */}
        <div className="flex items-center py-2 gap-2">
          <div className="w-24 flex-shrink-0"></div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="compilation"
              checked={metadata.compilation}
              onCheckedChange={(checked) =>
                handleInputChange("compilation", checked as boolean)
              }
              className="h-4 w-4"
              disabled={selectedSongs.length === 0}
            />
            <Label
              htmlFor="compilation"
              className="text-metadata-label text-xs font-normal"
            >
              Compilation
            </Label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        {artworkData && (
          <div className="mb-2 p-2 bg-primary/10 border border-primary/20 rounded text-xs">
            <span className="text-primary font-medium">
              ✓ Album artwork will be embedded
            </span>
            <br />
            <span className="text-muted-foreground">
              Resized to 1400x1400px
            </span>
          </div>
        )}

        {(pendingEdits.size > 0 || artworkChanged) && (
          <>
            <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <span className="text-yellow-700 font-medium">
                {pendingEdits.size > 0 &&
                  `${pendingEdits.size} song${
                    pendingEdits.size > 1 ? "s" : ""
                  } with pending changes`}
                {pendingEdits.size > 0 && artworkChanged && " + "}
                {artworkChanged && "artwork changes"}
              </span>
            </div>

            <Button
              onClick={handleSaveMetadata}
              disabled={
                (pendingEdits.size === 0 && !artworkChanged) || isWriting
              }
              className="w-full"
              size="sm"
            >
              {isWriting ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Writing...
                </>
              ) : (
                <>
                  {" "}
                  <Save size={14} className="mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </>
        )}
        {processedFiles.length > 0 && (
          <Button
            onClick={handleDownloadProcessed}
            variant="outline"
            className="w-full mt-2"
            size="sm"
          >
            <Download size={14} className="mr-2" />
            Download Files ({processedFiles.length})
          </Button>
        )}

        {/* {selectedSongs.filter((s) => s.file).length === 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            No files available for metadata writing
          </p>
        )} */}

        {selectedSongs.filter((s) => s.file).length < selectedSongs.length && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {selectedSongs.length - selectedSongs.filter((s) => s.file).length}{" "}
            sample songs will be skipped
          </p>
        )}

        {/* FFmpeg warning */}
        {/* <p className="text-xs text-muted-foreground mt-2 text-center">
            Note: File writing requires SharedArrayBuffer support.
            <br />
            Metadata changes are displayed in the UI.
          </p> */}
      </div>
    </div>
  );
};
