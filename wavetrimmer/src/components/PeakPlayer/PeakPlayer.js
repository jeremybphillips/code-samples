import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  clamp,
  getAudioBuffer,
  getNextZoomStep,
  getNextAmplitudeStep,
  getNextPreloadZoomStep,
  getFieldNameAndValueFromLog,
  getMinutesFromSeconds,
  debounce,
  throttle,
} from "@/lib/utils";
import {
  PLAYER_STATE,
  LARGE_FILE_SIZE,
  LONG_AUDIO_DURATION,
  MAX_FREE_AUDIO_DURATION,
} from "@/lib/constants";
import loadFfmpeg from "@/lib/load-ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import useEventInBounds from "@/lib/hooks/useEventInBounds";
import cn from "classnames";

import TrimSlider from "@/components/PeakPlayer/TrimSlider";
import ZoomViewContainer from "@/components/PeakPlayer/ZoomViewContainer";
import WaveScrollbar from "@/components/PeakPlayer/WaveScrollbar";
import ZoomSlider from "@/components/PeakPlayer/ZoomSlider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormatSelect from "@/components/ui/FormatSelect";
import FileActionBar from "@/components/ui/FileActionBar";
import PlayButton from "@/components/ui/PlayButton";
import { FaCropAlt } from "react-icons/fa";
import { GrPowerReset } from "react-icons/gr";
import styles from "./PeaksPlayer.module.css";
import PremiumFeature from "@/components/ui/auth/PremiumFeature";
import useAuthStore from "@/store/useAuthStore";

let isFileLoaded = false;

const PeakPlayer = ({ file, onReset, onError }) => {
  const { user } = useAuthStore();
  const isPremium = user?.premium;
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState([0, 0]);
  const [visibleRange, setViewableRange] = useState([0, 0]);
  const [audioSrc, setAudioSrc] = useState("");
  const [peaksInstance, setPeaksInstance] = useState(null);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef();
  const loudNormDataRef = useRef({});
  const zoomContainerRef = useRef();
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [format, setFormat] = useState("mp3");
  const [introFile, setIntroFile] = useState(null);
  const [outroFile, setOutroFile] = useState(null);
  const [downloadLink, setDownloadLink] = useState(null);
  const [zoomValue, setZoomValue] = useState();
  const [containerState, setContainerState] = useState(
    PLAYER_STATE.INITIALIZING,
  );

  const resetWaveformState = useCallback(() => {
    setIsPlaying(false);
    setDuration(0);
    setTrimRange([0, 0]);
    setViewableRange([0, 0]);
    setAudioSrc("");
    setPeaksInstance(null);
    setProgress(0);
    setDownloadLink(null);
    setZoomValue(undefined);
    setContainerState(PLAYER_STATE.INITIALIZING);
  }, []);

  useEffect(() => {
    if (!peaksInstance) {
      return;
    }

    //For audio over 30 minutes, pre-load the "zoom cache" for smoother zooming
    const view = peaksInstance.views.getView("zoomview");
    if (duration >= LONG_AUDIO_DURATION) {
      let i = duration;
      while (i >= 1) {
        view.setZoom({ seconds: i });
        i -= getNextPreloadZoomStep(i);
      }
      view.setZoom({ seconds: duration });
    }

    setContainerState(PLAYER_STATE.READY);
  }, [peaksInstance]);

  const initFFmpeg = async () => {
    ffmpegRef.current = await loadFfmpeg();

    ffmpegRef.current.on("progress", ({ progress }) => {
      setProgress(parseFloat((progress * 100).toFixed()));
    });
    
    ffmpegRef.current.on("log", ({ message }) => {
      const logData = getFieldNameAndValueFromLog(message);
      if (logData) {
        loudNormDataRef.current = { ...loudNormDataRef.current, ...logData };
      }
    });
  };

  useEffect(() => {
    async function processFile(file) {
      peaksInstance?.destroy();
      resetWaveformState();
      isFileLoaded = true;
      try {
        await handleFileLoad(file);
      } catch (error) {
        onError?.(error.message);
        console.error(error.message);
      }
    }

    if (file && !isFileLoaded) {
      processFile(file);
    }

    return () => {
      isFileLoaded = false;
    };
  }, [file]);

  useEffect(() => {
    if (!peaksInstance) {
      return;
    }

    const zoomviewContainer = document.getElementById("zoomview-container");

    let firstResize = true;
    const onResize = () => {
      if (firstResize) {
        firstResize = false;
        return;
      }

      peaksInstance.views.getView("zoomview").fitToContainer();
    };

    const resizeObserver = new ResizeObserver(debounce(onResize));
    resizeObserver.observe(zoomviewContainer);

    return () => {
      resizeObserver.unobserve(zoomviewContainer);
    };
  }, [peaksInstance]);

  useEffect(() => {
    if (zoomValue) {
      const view = peaksInstance.views.getView("zoomview");
      view.setZoom({ seconds: zoomValue });
      view.setAmplitudeScale(getNextAmplitudeStep(zoomValue));
    }
  }, [zoomValue]);

  const handleWheel = throttle(({ deltaY }) => {
    if (peaksInstance) {
      setZoomValue((prev) => {
        const step = getNextZoomStep(prev);
        const newZoomLevel = deltaY > 0 ? prev + step : prev - step;
        return clamp(newZoomLevel, 1, duration);
      });
    }
  });
  useEventInBounds("wheel", zoomContainerRef, handleWheel);
  useEventInBounds("keydown", zoomContainerRef, (event) => {
    if (event.key === " " || event.code === "Space") {
      handlePlayClick();
    }
  });

  const handleFileLoad = async (file) => {
    setAudioSrc(URL.createObjectURL(file));
    const startTime = performance.now();
    let audioBuffer = null;
    let audioLength = 0;

    try {
      audioBuffer = await getAudioBuffer(file);
      audioLength = audioBuffer.duration;

      if (
        !isPremium &&
        audioLength > MAX_FREE_AUDIO_DURATION
      ) {
        setContainerState(PLAYER_STATE.DURATION_EXCEEDED);
        return;
      }
    } catch (error) {
      throw error;
    }

    const endTime = performance.now();
    console.log(`Audio decoded in ${endTime - startTime}ms`);

    const options = {
      zoomview: {
        container: zoomContainerRef.current,
        showAxisLabels: false,
        autoScroll: false,
        playheadWidth: 4,
        playheadColor: "#FF6B00",        
        segmentOptions: {
          overlay: true,
          overlayOpacity: 0.25,
          overlayOffset: 0,
          overlayLabelAlign: "center",
          overlayFontStyle: "bold",
          overlayFontSize: 24,
        },
      },
      mediaElement: document.getElementById("audio"),
      zoomLevels: [32, 64, 128, 256, 512, 1024, 2048, 4096],
      keyboard: true,
      segments: [
        {
          id: "trimSelection",
          startTime: 0,
          endTime: audioLength,
          editable: false,
          color: "#2f43a3", // #aaa
        },
      ],
      webAudio: {
        audioBuffer,
      },
    };

    const startTime2 = performance.now();
    const { default: Peaks } = await import("peaks.js");
    Peaks.init(options, function (err, peaks) {
      // end timer
      if (err) {
        console.error("Failed to initialize Peaks instance: " + err.message);
        return;
      }
      peaks.on("zoomview.displaying", (start, end) => {
        setViewableRange([start, end]);
      });

      const view = peaks.views.getView("zoomview");
      view.setZoom({ seconds: audioLength });
      setDuration(audioLength);
      setViewableRange([0, audioLength]);
      setTrimRange([0, audioLength]);
      setZoomValue(audioLength);
      setPeaksInstance(peaks);

      const endTime2 = performance.now();
      console.log(`Peaks initialized in ${endTime2 - startTime2}ms`);
    });
  };

  const handlePlayClick = () => {
    isPlaying ? peaksInstance.player.pause() : peaksInstance.player.play();
    setIsPlaying(!isPlaying);
  };

  const handleRangeChange = ([start, end]) => {
    setTrimRange([start, end]);
    const segment = peaksInstance.segments.getSegment("trimSelection");
    segment.update({
      startTime: start,
      endTime: end,
    });
  };

  const handleRangeChangeComplete = ([start, end], droppedIndex) => {
    if (!isPlaying) {
      return;
    }

    const playFrom = droppedIndex === 0 ? start : clamp(end - 2, 0, end);
    peaksInstance.player.seek(playFrom);
    peaksInstance.player.play();
  };

  const handleCrop = async () => {
    //2 GB limit
    if (file.size > LARGE_FILE_SIZE) {
      alert("File size is too large");
      return;
    }

    setContainerState(PLAYER_STATE.PREPARING_TRIM);
    await initFFmpeg();
    peaksInstance.player.pause();
    setIsPlaying(false);

    const { name } = file;
    const filename = name.substring(0, name.lastIndexOf("."));
    const [start, end] = trimRange;

    const ffmpeg = ffmpegRef.current;
    await ffmpeg.writeFile(name, await fetchFile(file));

    // 128k or 192k also for bitrates
    const AACEncodingArgs = ["-c:a", "aac", "-b:a", "256k"];

    let outputFilename = `trimmed-${filename}.${format}`;
    const trimCmd = [
      "-i",
      name,
      "-ss",
      start.toString(),
      "-to",
      end.toString(),
      outputFilename,
    ];

    try {
      setContainerState(PLAYER_STATE.TRIMMING);
      await ffmpeg.exec(trimCmd);
    } catch (error) {
      console.error("Error trimming audio", error);
      return;
    }

    if (normalizeAudio) {
      const analyzeCmd = [
        "-i",
        outputFilename,
        "-vn",
        "-filter:a",
        "loudnorm=dual_mono=true:print_format=json",
        "-f",
        "null",
        "/dev/null",
      ];

      try {
        setContainerState(PLAYER_STATE.ANALYZING);
        await ffmpeg.exec(analyzeCmd);
      } catch (error) {
        console.error("Error analyzing audio for normaliztion", error);
        return;
      }

      // Normalize audio
      const { input_i, input_lra, input_tp, input_thresh } =
        loudNormDataRef.current;

      const inputFileName = outputFilename;
      outputFilename = `normalized-${outputFilename}`;
      const normalizeArgs = [
        "-i",
        inputFileName,
        "-vn",
        "-filter:a",
        `loudnorm=dual_mono=true:linear=true:measured_I=${input_i}:measured_LRA=${input_lra}:measured_tp=${input_tp}:measured_thresh=${input_thresh}`,
        outputFilename,
      ];

      try {
        setContainerState(PLAYER_STATE.NORMALIZING);
        await ffmpeg.exec(normalizeArgs);
      } catch (error) {
        console.error("Error normalizing audio", error);
        return;
      }
    }

    if (introFile || outroFile) {
      if (introFile && outroFile) {
        setContainerState(PLAYER_STATE.MERGING_INTRO_OUTRO);
      } else if (introFile) {
        setContainerState(PLAYER_STATE.MERGING_INTRO);
      } else {
        setContainerState(PLAYER_STATE.MERGING_OUTRO);
      }

      let filterComplex = "";
      const inputs = [];
      if (introFile) {
        filterComplex = "[0:0][1:0]";
        inputs.push("-i", introFile.name);
        await ffmpeg.writeFile(introFile.name, await fetchFile(introFile));
      }

      if (outroFile) {
        filterComplex = "[1:0][0:0]";
        inputs.push("-i", outroFile.name);
        await ffmpeg.writeFile(outroFile.name, await fetchFile(outroFile));
      }

      if (introFile && outroFile) {
        filterComplex = "[0:0][2:0][1:0]";
      }

      filterComplex += `concat=n=${introFile && outroFile ? 3 : 2}:v=0:a=1[a]`;

      const inputFileName = outputFilename;
      outputFilename = `appended-${outputFilename}`;
      const mergeCmd = [
        ...inputs,
        "-i",
        inputFileName,
        "-filter_complex",
        filterComplex,
        "-map",
        "[a]",
        outputFilename,
      ];

      try {
        await ffmpeg.exec(mergeCmd);
      } catch (error) {
        console.error("Error adding intro and/or outro", error);
        return;
      }
    }

    setContainerState(PLAYER_STATE.DOWNLOAD_READY);
    const fileData = await ffmpeg.readFile(outputFilename);
    const objectURL = URL.createObjectURL(new Blob([fileData.buffer]));
    setDownloadLink(objectURL);
  };

  return (
    <>
      <div className={"ud-flex ud-flex-col player-container"}>
        <div className="ud-w-full ud-pb-6">
          <TrimSlider
            disabled={containerState !== PLAYER_STATE.READY}
            duration={duration}
            min={Number(visibleRange[0])}
            max={Number(visibleRange[1])}
            onChange={handleRangeChange}
            onChangeComplete={handleRangeChangeComplete}
          />
          <ZoomViewContainer
            audioSrc={audioSrc}
            containerState={containerState}
            downloadLink={downloadLink}
            fileName={file?.name}
            format={format}
            ref={zoomContainerRef}
            progress={progress}
            onCancel={() => {
              setDownloadLink(null);
              setContainerState(PLAYER_STATE.READY);
            }}
          />
          <WaveScrollbar
            visibleStart={visibleRange[0]}
            visibleEnd={visibleRange[1]}
            duration={duration}
            onSeek={(time) => peaksInstance?.views.getView("zoomview")?.setStartTime(time)}
            visible={[
              PLAYER_STATE.READY,              
            ].includes(containerState)}
          />
        </div>
      </div>
      <div
        className={cn(
          "ud-flex ud-flex-col ud-gap-y-9 controls-container",
          styles.controls,
          {
            "ud-opacity-0": [PLAYER_STATE.INITIALIZING, PLAYER_STATE.DURATION_EXCEEDED].includes(containerState),
          },
        )}
      >
        <div className="ud-flex ud-flex-col xl:ud-flex-row ud-w-full ud-gap-4">
          <div className="ud-flex ud-items-center ud-justify-between ud-w-full xl:ud-w-1/2">
            <PlayButton
              onClick={handlePlayClick}
              isPlaying={isPlaying}
              disabled={containerState !== PLAYER_STATE.READY}
              className="ud-mr-10"
            />
            <div className="ud-flex ud-items-center ud-gap-x-4">
              <ZoomSlider
                value={zoomValue}
                max={duration}
                onChange={setZoomValue}
                disabled={containerState !== PLAYER_STATE.READY}
              />
              <Button
                onClick={() => {
                  isFileLoaded = false;
                  peaksInstance?.destroy();
                  resetWaveformState();
                  onReset();
                }}
                icon={<GrPowerReset />}
                fullWidth={false}
              >
                Reset
              </Button>
            </div>
          </div>
          <div className="ud-flex ud-gap-x-4 ud-items-center ud-w-full xl:ud-w-1/2 xl:ud-justify-end">
            <Button
              onClick={handleCrop}
              disabled={
                containerState !== PLAYER_STATE.READY ||
                (trimRange[0] === 0 && trimRange[1] >= duration)
              }
              icon={<FaCropAlt />}
              fullWidth={false}
            >
              Crop
            </Button>
            <PremiumFeature>
              <Checkbox
                label="Maximize volume"
                onChange={setNormalizeAudio}
                disabled={containerState !== PLAYER_STATE.READY}
              />
            </PremiumFeature>
            <FormatSelect
              onChange={setFormat}
              disabled={containerState !== PLAYER_STATE.READY}
            />
          </div>
        </div>        
        <PremiumFeature>
          <div className="ud-flex ud-flex-col xl:ud-flex-row ud-gap-4">
            <div className="ud-w-full xl:ud-w-1/2">
              <FileActionBar
                isIntro={true}
                onFileAdd={setIntroFile}
                disabled={containerState !== PLAYER_STATE.READY}
              />
            </div>
            <div className="ud-w-full xl:ud-w-1/2">
              <FileActionBar
                isIntro={false}
                onFileAdd={setOutroFile}
                disabled={containerState !== PLAYER_STATE.READY}
              />
            </div>
          </div>
        </PremiumFeature>
      </div>
    </>
  );
};

export default PeakPlayer;
