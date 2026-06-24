import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  FileAudio,
  ArrowUp,
  ArrowDown,
  Loader2,
  RotateCcw,
  Trash2,
  Music,
  Upload,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ResetConfirmDialog } from "@/components/ResetConfirmDialog";
import { metadataService, type AudioMetadata } from "@/lib/metadataService";
import { SUPPORTED_AUDIO_FORMATS } from "@/lib/audioFormats";
import { useSongStore } from "@/store/songStore";
import { Link } from "react-router-dom";

type DroppedFile = {
  file: File;
  path?: string;
  metadata?: AudioMetadata;
};

type DroppedItem = {
  files: DroppedFile[];
  folders: string[];
};

export type Song = {
  id: string;
  artist: string;
  title: string;
  trackNumber: string;
  totalTracks?: string;
  album: string;
  year: string;
  discNumber?: string;
  totalDiscs?: string;
  file?: File; // Added file reference for metadata operations
  metadata?: AudioMetadata; // Added parsed metadata
};

type SongTableProps = {
  onSelectionChange?: (selectedSongs: Song[]) => void;
  onFilesDropped?: (droppedItems: DroppedItem) => void;
  songs?: Song[]; // Optional initial songs
  onSongsChanged?: (songs: Song[]) => void; // Callback when songs list changes
};

const columnHelper = createColumnHelper<Song>();

export const SongTable = ({
  onSelectionChange,
  onFilesDropped,
  songs: externalSongs,
  onSongsChanged,
}: SongTableProps) => {
  const {
    songs,
    setSongs,
    addSongs,
    selectedSongIds,
    setSelectedSongs,
    pendingEdits,
    artworkData,
    removeSong,
    resetAll,
  } = useSongStore();

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dragActive, setDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [columnWidths, setColumnWidths] = useState({
    select: 40,
    title: 350,
    artist: 250,
    trackNumber: 60,
    album: 350,
    year: 60,
    remove: 40,
  });

  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  // Get songs with live edits applied - avoiding function dependency
  const songsWithEdits = useMemo(() => {
    return songs.map((song) => {
      const edits = pendingEdits.get(song.id);
      if (!edits) return song;

      // Apply pending edits to create a virtual song with live updates
      return {
        ...song,
        title: edits.title !== undefined ? edits.title : song.title,
        artist: edits.artist !== undefined ? edits.artist : song.artist,
        album: edits.album !== undefined ? edits.album : song.album,
        year: edits.year !== undefined ? edits.year : song.year,
        trackNumber:
          edits.trackNumber !== undefined
            ? edits.trackNumber
            : song.trackNumber,
        totalTracks:
          edits.totalTracks !== undefined
            ? edits.totalTracks
            : song.totalTracks,
        discNumber:
          edits.discNumber !== undefined ? edits.discNumber : song.discNumber,
        totalDiscs:
          edits.totalDiscs !== undefined ? edits.totalDiscs : song.totalDiscs,
      };
    });
  }, [songs, pendingEdits]);

  // Sync external songs with store
  useEffect(() => {
    if (externalSongs) {
      setSongs(externalSongs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSongs]);

  // Sync row selection with store
  useEffect(() => {
    const selectedIds = Object.keys(rowSelection).filter(
      (key) => rowSelection[key]
    );
    setSelectedSongs(selectedIds);
  }, [rowSelection, setSelectedSongs]);

  // Notify parent of selection changes
  useEffect(() => {
    const selectedRows = selectedSongIds
      .map((id) => songsWithEdits.find((song) => song.id === id))
      .filter((song): song is Song => song !== undefined);

    onSelectionChange?.(selectedRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSongIds.length, selectedSongIds.join(",")]);

  // Helper function to check if a file is a supported audio format
  const isSupportedAudioFile = (file: File): boolean => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    return extension ? SUPPORTED_AUDIO_FORMATS.includes(extension) : false;
  };

  // Helper function to process dropped files
  const processDroppedItems = async (
    items: DataTransferItemList
  ): Promise<DroppedItem> => {
    const droppedFiles: DroppedFile[] = [];
    const droppedFolders: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();

        if (entry) {
          if (entry.isFile) {
            const file = item.getAsFile();
            if (file && isSupportedAudioFile(file)) {
              droppedFiles.push({
                file,
                path: entry.fullPath,
              });
            }
          } else if (entry.isDirectory) {
            droppedFolders.push(entry.fullPath);
            // Process directory contents recursively
            const directoryFiles = await processDirectory(
              entry as FileSystemDirectoryEntry
            );
            droppedFiles.push(...directoryFiles);
          }
        } else {
          // Fallback for files without webkitGetAsEntry support
          const file = item.getAsFile();
          if (file && isSupportedAudioFile(file)) {
            droppedFiles.push({ file });
          }
        }
      }
    }

    return { files: droppedFiles, folders: droppedFolders };
  };

  // Helper function to recursively process directory contents
  const processDirectory = async (
    directoryEntry: FileSystemDirectoryEntry
  ): Promise<DroppedFile[]> => {
    const files: DroppedFile[] = [];

    return new Promise((resolve) => {
      const reader = directoryEntry.createReader();

      const readEntries = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(files);
            return;
          }

          for (const entry of entries) {
            if (entry.isFile) {
              const file = await getFileFromEntry(entry as FileSystemFileEntry);
              if (file && isSupportedAudioFile(file)) {
                files.push({
                  file,
                  path: entry.fullPath,
                });
              }
            } else if (entry.isDirectory) {
              const subFiles = await processDirectory(
                entry as FileSystemDirectoryEntry
              );
              files.push(...subFiles);
            }
          }

          // Continue reading if there might be more entries
          readEntries();
        });
      };

      readEntries();
    });
  };

  // Helper function to convert FileSystemFileEntry to File
  const getFileFromEntry = (fileEntry: FileSystemFileEntry): Promise<File> => {
    return new Promise((resolve) => {
      fileEntry.file((file) => resolve(file));
    });
  };

  // Enhanced handler for processing dropped files with metadata reading
  const handleDroppedFiles = async (droppedItems: DroppedItem) => {
    // Call the parent handler if provided
    onFilesDropped?.(droppedItems);

    // Process files and read metadata
    if (droppedItems.files.length > 0) {
      setIsProcessingFiles(true);
      setProcessingProgress(0);

      try {
        const newSongs: Song[] = [];

        // Process files sequentially to manage memory and show progress
        for (let i = 0; i < droppedItems.files.length; i++) {
          const droppedFile = droppedItems.files[i];
          const progress = ((i + 1) / droppedItems.files.length) * 100;
          setProcessingProgress(progress);

          try {
            // Read metadata from audio file
            const metadata = await metadataService.readMetadata(
              droppedFile.file
            );

            // Create song object from metadata
            const song: Song = {
              id: `file-${Date.now()}-${i}`,
              title:
                metadata.title ||
                droppedFile.file.name.replace(/\.[^/.]+$/, ""),
              artist: metadata.artist || "Unknown Artist",
              album: metadata.album || "Unknown Album",
              year: metadata.year?.toString() || "",
              trackNumber: metadata.trackNumber?.toString() || "",
              totalTracks: metadata.totalTracks?.toString(),
              discNumber: metadata.discNumber?.toString(),
              totalDiscs: metadata.totalDiscs?.toString(),
              file: droppedFile.file,
              metadata: metadata,
            };

            newSongs.push(song);
          } catch (error) {
            console.error(
              `Failed to read metadata for ${droppedFile.file.name}:`,
              error
            );

            // Add file without metadata as fallback
            const song: Song = {
              id: `file-${Date.now()}-${i}`,
              title: droppedFile.file.name.replace(/\.[^/.]+$/, ""),
              artist: "Unknown Artist",
              album: "Unknown Album",
              year: "",
              trackNumber: "",
              file: droppedFile.file,
            };

            newSongs.push(song);
          }
        }

        // Add new songs to the table
        addSongs(newSongs);
      } catch (error) {
        console.error("Error processing dropped files:", error);
      } finally {
        setIsProcessingFiles(false);
        setProcessingProgress(0);
      }
    }
  };

  const handleCheckboxClick = useCallback(
    (
      rowIndex: number,
      rowId: string,
      event: React.MouseEvent,
      toggleSelected: (value?: boolean) => void
    ) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;

      if (isShift && lastClickedIndex !== null) {
        // Range selection with shift
        const start = Math.min(lastClickedIndex, rowIndex);
        const end = Math.max(lastClickedIndex, rowIndex);

        // Get current selection state
        const newSelection = { ...rowSelection };

        // Select range
        for (let i = start; i <= end; i++) {
          newSelection[songsWithEdits[i].id] = true;
        }

        setRowSelection(newSelection);
      } else if (isCtrlOrCmd) {
        // Toggle selection with ctrl/cmd
        toggleSelected();
        setLastClickedIndex(rowIndex);
      } else {
        // Normal checkbox behavior
        toggleSelected();
        setLastClickedIndex(rowIndex);
      }
    },
    [lastClickedIndex, rowSelection, songsWithEdits, setRowSelection]
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-[2px]"
            {...(table.getIsSomePageRowsSelected() && {
              "data-state": "indeterminate",
            })}
          />
        ),
        cell: ({ row, table }) => {
          const rowIndex = table
            .getRowModel()
            .rows.findIndex((r) => r.id === row.id);
          return (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="translate-y-[2px]"
              onClick={(e) => {
                e.preventDefault(); // Prevent default checkbox behavior
                handleCheckboxClick(rowIndex, row.id, e, (value) =>
                  row.toggleSelected(value)
                );
              }}
            />
          );
        },
        enableSorting: false,
        enableResizing: false,
      }),
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => (
          <div className="truncate" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor("artist", {
        header: "Artist",
        cell: (info) => (
          <div className="truncate" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor("trackNumber", {
        header: "Track",
        cell: (info) => <div>{info.getValue()}</div>,
      }),
      columnHelper.accessor("album", {
        header: "Album",
        cell: (info) => (
          <div className="truncate" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor("year", {
        header: "Year",
        cell: (info) => <div>{info.getValue()}</div>,
      }),
      columnHelper.display({
        id: "remove",
        header: "",
        cell: (info) => (
          <Trash2
            size={16}
            className="mt-1 ml-2 hover:text-red-600 cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              removeSong(info.row.original.id);
            }}
          />
        ),
        enableSorting: false,
        enableResizing: false,
      }),
    ],
    [removeSong, handleCheckboxClick]
  );

  const table = useReactTable({
    data: songsWithEdits,
    columns,
    state: {
      rowSelection,
      sorting,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    resetAll();
    setShowResetConfirm(false);
    setRowSelection({});
    setLastClickedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setDragActive(false);
      }
      return newCounter;
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragCounter(0);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      try {
        const droppedItems = await processDroppedItems(items);

        if (droppedItems.files.length > 0 || droppedItems.folders.length > 0) {
          await handleDroppedFiles(droppedItems);
        } else {
          console.warn("No supported audio files found in dropped items");
        }
      } catch (error) {
        console.error("Error processing dropped files:", error);
      }
    }
  };

  // Handle click to open file dialog
  const handleEmptyTableClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = false; // Start with files, user can switch to folders

    // Accept all supported audio formats
    const acceptedTypes = SUPPORTED_AUDIO_FORMATS.map((ext) => {
      // Map extensions to MIME types for common formats
      switch (ext) {
        case "mp3":
          return "audio/mpeg";
        case "m4a":
        case "mp4":
          return "audio/mp4";
        case "flac":
          return "audio/flac";
        case "wav":
          return "audio/wav";
        case "ogg":
          return "audio/ogg";
        case "webm":
          return "audio/webm";
        case "aac":
          return "audio/aac";
        default:
          return `audio/${ext}`;
      }
    });

    input.accept = acceptedTypes.join(",") + ",audio/*";

    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);

      if (files.length > 0) {
        const audioFiles = files.filter(isSupportedAudioFile);

        if (audioFiles.length > 0) {
          const droppedFiles: DroppedFile[] = audioFiles.map((file) => ({
            file,
            path: file.webkitRelativePath || file.name,
          }));

          const droppedItems: DroppedItem = {
            files: droppedFiles,
            folders: [],
          };

          await handleDroppedFiles(droppedItems);
        } else {
          console.warn("No supported audio files found in selected files");
        }
      }

      target.value = ""; // Reset input
    };

    input.click();
  };

  // Handle folder selection
  const handleFolderSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true; // Enable folder selection

    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);

      if (files.length > 0) {
        const audioFiles = files.filter(isSupportedAudioFile);

        if (audioFiles.length > 0) {
          const droppedFiles: DroppedFile[] = audioFiles.map((file) => ({
            file,
            path: file.webkitRelativePath || file.name,
          }));

          const droppedItems: DroppedItem = {
            files: droppedFiles,
            folders:
              files.length > 0
                ? [files[0].webkitRelativePath.split("/")[0]]
                : [],
          };

          await handleDroppedFiles(droppedItems);
        } else {
          console.warn("No supported audio files found in selected folder");
        }
      }

      target.value = ""; // Reset input
    };

    input.click();
  };

  const handleResizeStart = (e: React.MouseEvent, column: string) => {
    e.stopPropagation();
    resizingColumn.current = column;
    startX.current = e.clientX;
    startWidth.current = columnWidths[column as keyof typeof columnWidths];

    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;

    const diff = e.clientX - startX.current;

    // Find the next resizable column to take space from (skip year and select columns)
    const columns = ["title", "artist", "trackNumber", "album"];
    const currentIndex = columns.indexOf(resizingColumn.current);

    // Don't allow resizing the last column
    if (currentIndex === -1 || currentIndex === columns.length - 1) {
      return;
    }

    // Get the next column
    const nextColumn = columns[currentIndex + 1];
    const nextColumnWidth =
      columnWidths[nextColumn as keyof typeof columnWidths];

    // Calculate new widths ensuring both stay above minimum
    const newWidth = startWidth.current + diff;
    const nextColumnNewWidth = nextColumnWidth - diff;

    // Only apply changes if both columns can accommodate the change
    if (newWidth >= 50 && nextColumnNewWidth >= 50) {
      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn.current!]: newWidth,
        [nextColumn]: nextColumnNewWidth,
      }));
    }
  };

  const handleResizeEnd = () => {
    resizingColumn.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  };

  const SortIcon = ({ columnId }: { columnId: string }) => {
    const sortingState = sorting.find((s) => s.id === columnId);
    if (!sortingState) return null;
    return sortingState.desc ? (
      <ArrowDown size={14} className="inline ml-1" />
    ) : (
      <ArrowUp size={14} className="inline ml-1" />
    );
  };

  const gridCols = `${columnWidths.select}px ${columnWidths.title}px ${columnWidths.artist}px ${columnWidths.trackNumber}px ${columnWidths.album}px ${columnWidths.year}px ${columnWidths.remove}px`;
  const resizableColumns = ["title", "artist", "trackNumber", "album"];
  const rowCount = table.getRowModel().rows.length;

  return (
    <div
      className={cn(
        "h-full bg-card border border-border rounded-lg overflow-hidden relative",
        dragActive && "border-primary border-2"
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-table-header border-b border-border">
          <div
            className="grid gap-2 px-2 py-2 text-base font-medium text-foreground"
            style={{ gridTemplateColumns: gridCols }}
          >
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header, index) => (
                <div
                  key={header.id}
                  className={cn(
                    "relative",
                    header.column.id === "select" &&
                      "text-center flex items-center justify-center"
                  )}
                >
                  {header.isPlaceholder ? null : (
                    <>
                      <div
                        className={cn(
                          header.column.getCanSort() &&
                            "cursor-pointer hover:text-primary",
                          (header.column.id === "trackNumber" ||
                            header.column.id === "year") &&
                            "text-center"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <SortIcon columnId={header.column.id} />
                        )}
                      </div>
                      {resizableColumns.includes(header.column.id) && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 group"
                          onMouseDown={(e) =>
                            handleResizeStart(e, header.column.id)
                          }
                        >
                          <div className="w-px h-full bg-muted-foreground/30 group-hover:bg-primary" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto">
          {rowCount === 0 ? (
            <div
              className="h-full flex flex-col items-center justify-center p-8 text-muted-foreground cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={handleEmptyTableClick}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Music size={64} className="opacity-40" />
                  <Upload
                    size={24}
                    className="absolute -bottom-1 -right-1 bg-background rounded-full p-1"
                  />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium">No Music Files</h3>
                  <p className="text-sm opacity-75 max-w-md">
                    Click here to select files, or drag & drop audio files or
                    folders. Supports MP3, FLAC, AAC, and 20+ other formats.
                  </p>
                  <Link
                    to="/help"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <HelpCircle size={14} />
                    Need help getting started?
                  </Link>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEmptyTableClick();
                    }}
                    className="flex items-center gap-2"
                  >
                    <Upload size={16} />
                    Select Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderSelect();
                    }}
                    className="flex items-center gap-2"
                  >
                    <Upload size={16} />
                    Select Folder
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            table.getRowModel().rows.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  "grid gap-2 px-2 py-2 text-base",
                  "border-b border-border/50",
                  row.getIsSelected()
                    ? "bg-table-selected text-table-selected-foreground"
                    : "bg-table-row text-foreground",
                  !row.getIsSelected() && "hover:bg-table-row-hover"
                )}
                style={{ gridTemplateColumns: gridCols }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className={cn(
                      cell.column.id === "select" &&
                        "flex items-center justify-center"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {rowCount > 0 && (
          <>
            <div className="bg-table-header border-t border-border px-4 text-base text-muted-foreground py-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>
                  {Object.keys(rowSelection).length} of {songsWithEdits.length}{" "}
                  Selected
                </span>
                {isProcessingFiles && (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Processing files... {Math.round(processingProgress)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmptyTableClick}
                  className={cn(
                    "flex items-center gap-2 transition-all",
                    (songs.length > 0 ||
                      artworkData ||
                      pendingEdits.size > 0) &&
                      "shadow-md"
                  )}
                >
                  <Upload size={14} />
                  Add Files
                </Button>
                <Button
                  variant={
                    songs.length > 0 || artworkData || pendingEdits.size > 0
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={handleResetClick}
                  className={cn(
                    "flex items-center gap-2 transition-all",
                    (songs.length > 0 ||
                      artworkData ||
                      pendingEdits.size > 0) &&
                      "bg-orange-600 hover:bg-orange-700 text-white shadow-md"
                  )}
                >
                  <RotateCcw size={14} />
                  Reset & Start Over
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {dragActive && (
        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none">
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium text-center">
            <div className="text-lg font-semibold mb-2">
              Drop audio files or folders here
            </div>
            <div className="text-sm opacity-90">
              Supported formats: MP3, M4A, FLAC, AAC, OGG, and more
            </div>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessingFiles && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center pointer-events-none">
          <div className="bg-card border border-border px-6 py-4 rounded-lg shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="font-medium">Reading metadata...</span>
            </div>
            <div className="w-64 bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <div className="text-sm text-muted-foreground mt-1 text-center">
              {Math.round(processingProgress)}% complete
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <ResetConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        onConfirm={handleResetConfirm}
      />
    </div>
  );
};
