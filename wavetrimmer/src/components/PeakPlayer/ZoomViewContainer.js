import { useState, useEffect, forwardRef } from "react";
import cn from "classnames";
import Link from "next/link";
import { PLAYER_STATE } from "@/lib/constants";

import { FaCloudDownloadAlt } from "react-icons/fa";
import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar/ProgressBar";
import styles from "./ZoomViewContainer.module.css";

function bytesToSize(bytes) {
  if (bytes === 0) return;

  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

const ZoomViewContainer = forwardRef(
  (
    {
      audioSrc,
      containerState,
      downloadLink,
      fileName,
      format,
      onCancel,
      progress,
    },
    ref
  ) => {
    const [analyzingProgress, setAnalyzingProgress] = useState(0);
    const [normalizingProgress, setNormalizingProgress] = useState(0);

    useEffect(() => {
      if (progress) {
        if (containerState === PLAYER_STATE.ANALYZING) {
          setAnalyzingProgress(progress);
        } else if (containerState === PLAYER_STATE.NORMALIZING) {
          setNormalizingProgress(progress);
        } else {
          setAnalyzingProgress(0);
          setNormalizingProgress(0);
        }
      }
    }, [progress]);

    const showSpinner = ![
      PLAYER_STATE.ANALYZING,
      PLAYER_STATE.NORMALIZING,
    ].includes(containerState);

    const handleDownloadClick = () => {
      const anchorTag = document.createElement("a");
      anchorTag.href = downloadLink;
      anchorTag.download = `${fileName} (wavetrimmer.com).${format}`;
      document.body.appendChild(anchorTag);
      anchorTag.click();
      document.body.removeChild(anchorTag);
    };

    return (
      <>
        {/* Loading status and waveform */}
        <div
          id="zoomview-container"
          tabIndex="0"
          ref={ref}
          className={cn("ud-rounded-md", styles.zoomviewContainer, {
            "ud-hidden": ![
              PLAYER_STATE.READY,
              PLAYER_STATE.INITIALIZING,
            ].includes(containerState),
          })}
        >
          <div
            className={cn(
              "ud-flex ud-flex-col ud-items-center ud-justify-center ud-gap-y-6 ud-mx-8 ud-h-full"
            )}
          >
            <Spinner />
            <h3 className="ud-font-bold ud-text-black ud-text-xl sm:ud-text-2xl lg:ud-text-xl xl:ud-text-2xl ud-mt-12">
              Loading file...
            </h3>
          </div>
        </div>
        {/* Proccessing status */}
        <div
          className={cn("ud-rounded-md", styles.zoomviewContainer, {
            "ud-hidden": [
              PLAYER_STATE.READY,
              PLAYER_STATE.INITIALIZING,
              PLAYER_STATE.DOWNLOAD_READY,
              PLAYER_STATE.DURATION_EXCEEDED,
            ].includes(containerState),
          })}
        >
          <div
            className={cn(
              "ud-flex ud-flex-col ud-items-center ud-justify-center ud-gap-y-6 ud-mx-8 ud-h-full"
            )}
          >
            <div className="ud-flex ud-items-center ud-justify-center ud-w-full">
              {containerState === PLAYER_STATE.ANALYZING && (
                <ProgressBar completed={analyzingProgress} />
              )}
              {containerState === PLAYER_STATE.NORMALIZING && (
                <ProgressBar completed={normalizingProgress} />
              )}
            </div>
            {showSpinner && <Spinner />}
            <h3 className="ud-font-bold ud-text-black ud-text-xl sm:ud-text-2xl lg:ud-text-xl xl:ud-text-2xl ud-mt-12">
              {containerState}
            </h3>
          </div>
        </div>
        {/* Download button */}
        <div
          className={cn("ud-rounded-md", styles.zoomviewContainer, {
            "ud-hidden": containerState !== PLAYER_STATE.DOWNLOAD_READY,
          })}
        >
          <div className="ud-flex ud-flex-col ud-items-center ud-justify-center ud-gap-y-6 ud-mx-8 ud-h-full ud-gap-x-12">
            <Button
              className={cn(styles["download-button"], "ud-h-[75px]")}
              onClick={handleDownloadClick}
              icon={<FaCloudDownloadAlt />}
              fullWidth={false}
            >
              Download
            </Button>
            <Button onClick={onCancel} fullWidth={false}>
              Back
            </Button>
          </div>
        </div>
        {/* Duration limit exceeded */}
        <div
          className={cn("ud-rounded-md", styles.zoomviewContainer, {
            "ud-hidden": containerState !== PLAYER_STATE.DURATION_EXCEEDED,
          })}
        >
          <div className="ud-flex ud-flex-col ud-items-center ud-justify-center ud-gap-y-6 ud-mx-8 ud-h-full">
            <h3 className="ud-font-bold ud-text-black ud-text-xl sm:ud-text-2xl lg:ud-text-xl xl:ud-text-2xl">
              Audio exceeds the free limit
            </h3>
            <p className="ud-text-center ud-text-body-color">
              Free accounts can trim audio up to 30 minutes. Upgrade to Pro to trim longer files.
            </p>
            <Link href="/checkout/order">
              <Button fullWidth={false}>Upgrade to Pro</Button>
            </Link>
          </div>
        </div>
        <audio id="audio">
          {audioSrc && <source src={audioSrc} type="audio/mpeg" />}
          Your browser does not support the audio element.
        </audio>
      </>
    );
  }
);

export default ZoomViewContainer;
