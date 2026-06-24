import { useState, useEffect } from "react";
import { ImageIcon, Upload, Edit2, X } from "lucide-react";
import { resizeImageTo1400x1400 } from "@/lib/utils";
import { useSongStore } from "@/store/songStore";

type AlbumArtworkProps = {
  src?: string;
  alt?: string;
  onArtworkChange?: (
    imageData: string | null,
    originalFile: File | null
  ) => void;
};

export const AlbumArtwork = ({
  src,
  alt = "Album artwork",
  onArtworkChange,
}: AlbumArtworkProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(src || null);
  const [dragActive, setDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get selected song IDs from the store
  const selectedSongIds = useSongStore((state) => state.selectedSongIds);
  const hasSelection = selectedSongIds.length > 0;

  // Sync local state with prop changes (e.g., when store resets)
  useEffect(() => {
    setImageSrc(src || null);
  }, [src]);

  /**
   * Check if songs are selected before allowing artwork changes
   */
  const checkSelectionBeforeAction = (): boolean => {
    if (!hasSelection) {
      setErrorMessage("Please select one or more songs first");
      setTimeout(() => setErrorMessage(null), 5000);
      return false;
    }
    return true;
  };

  /**
   * Handle click to open file dialog
   */
  const handleClick = () => {
    if (!checkSelectionBeforeAction()) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/jpg";
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file && (file.type === "image/jpeg" || file.type === "image/jpg")) {
        processAndResizeImage(file);
      } else if (file) {
        setErrorMessage("Only JPG/JPEG files are supported for album artwork");
        setTimeout(() => setErrorMessage(null), 5000);
      }
      target.value = "";
    };
    input.click();
  };

  /**
   * Clear the current image
   */
  const handleClearImage = () => {
    setImageSrc(null);
    setErrorMessage(null);
    onArtworkChange?.(null, null);
  };

  /**
   * Process and resize the uploaded image
   */
  const processAndResizeImage = async (file: File) => {
    try {
      setErrorMessage(null);
      const resizedImageData = await resizeImageTo1400x1400(file);
      setImageSrc(resizedImageData);
      onArtworkChange?.(resizedImageData, file);
    } catch (error) {
      console.error("Failed to process image:", error);
      setErrorMessage("Failed to process image");
      onArtworkChange?.(null, null);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => {
      const newCount = prev + 1;
      if (newCount === 1) {
        setDragActive(true);
        setErrorMessage(null);
      }
      return newCount;
    });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setDragActive(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset drag state
    setDragActive(false);
    setDragCounter(0);

    // Check if songs are selected before accepting artwork
    if (!checkSelectionBeforeAction()) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(
      (file) => file.type === "image/jpeg" || file.type === "image/jpg"
    );

    if (imageFile) {
      processAndResizeImage(imageFile);
    } else {
      // Show error for unsupported file types
      setErrorMessage("Only JPG/JPEG files are supported for album artwork");
      setTimeout(() => setErrorMessage(null), 3000); // Clear error after 3 seconds
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={`
          relative w-full aspect-square bg-card border-2 border-dashed rounded-md overflow-hidden group
          ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }
          ${
            !imageSrc
              ? "hover:border-primary/50 hover:bg-primary/5"
              : "border-solid"
          }
          transition-all duration-200 cursor-pointer
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {imageSrc ? (
          <>
            <img
              src={imageSrc}
              alt={alt}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                title="Change image"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearImage();
                }}
                className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
                title="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-muted-foreground">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <ImageIcon size={48} className="opacity-40" />
                <Upload
                  size={20}
                  className="absolute -bottom-1 -right-1 bg-background rounded-full p-1"
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Album Artwork</p>
                <p className="text-xs opacity-75">
                  Click or drag & drop JPG image
                </p>
              </div>
            </div>
          </div>
        )}

        {dragActive && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-medium">
              Drop JPG image here
            </span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
