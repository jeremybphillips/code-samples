"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import cn from "classnames";
import styles from "./WaveScrollbar.module.css";

const MIN_THUMB_PERCENT = 5; // minimum thumb width as % of track

const WaveScrollbar = ({ visibleStart, visibleEnd, duration, onSeek, visible }) => {
  const trackRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const [isActive, setIsActive] = useState(false);

  const thumbWidthPercent = duration > 0
    ? Math.max(((visibleEnd - visibleStart) / duration) * 100, MIN_THUMB_PERCENT)
    : 100;

  const maxLeftPercent = 100 - thumbWidthPercent;
  const thumbLeftPercent = duration > 0
    ? Math.min((visibleStart / duration) * 100, maxLeftPercent)
    : 0;

  const isScrollable = thumbWidthPercent < 100;

  const seekToTrackX = useCallback(
    (clientX) => {
      if (!trackRef.current || !isScrollable) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const trackWidth = rect.width;
      const thumbWidthPx = (thumbWidthPercent / 100) * trackWidth;

      // Center the thumb on where the user clicked
      const newLeftPx = relativeX - thumbWidthPx / 2;
      const clampedLeftPx = Math.max(0, Math.min(newLeftPx, trackWidth - thumbWidthPx));
      const newStart = (clampedLeftPx / trackWidth) * duration;
      onSeek(newStart);
    },
    [duration, thumbWidthPercent, isScrollable, onSeek]
  );

  const handleTrackMouseDown = useCallback(
    (e) => {
      // Only act when clicking the track itself, not the thumb
      if (e.target !== trackRef.current) return;
      e.preventDefault();
      seekToTrackX(e.clientX);
    },
    [seekToTrackX]
  );

  const handleThumbMouseDown = useCallback(
    (e) => {
      if (!isScrollable) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartTime.current = visibleStart;
      setIsActive(true);
    },
    [visibleStart, isScrollable]
  );

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const trackWidth = rect.width;
      const thumbWidthPx = (thumbWidthPercent / 100) * trackWidth;
      const maxLeftPx = trackWidth - thumbWidthPx;

      const deltaPx = e.clientX - dragStartX.current;
      const deltaSeconds = (deltaPx / trackWidth) * duration;
      const newStart = dragStartTime.current + deltaSeconds;
      const clampedStart = Math.max(
        0,
        Math.min(newStart, (maxLeftPx / trackWidth) * duration)
      );
      onSeek(clampedStart);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setIsActive(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [duration, thumbWidthPercent, onSeek]);

  if (!visible) return null;

  return (
    <div
      ref={trackRef}
      onMouseDown={handleTrackMouseDown}
      className={cn(styles.track, { [styles.scrollable]: isScrollable })}
      title="Drag to scroll waveform"
    >
      <div
        onMouseDown={handleThumbMouseDown}
        className={cn(styles.thumb, {
          [styles.scrollable]: isScrollable,
          [styles.dragging]: isActive,
        })}
        style={{
          width: `${thumbWidthPercent}%`,
          left: `${thumbLeftPercent}%`,
        }}
      />
    </div>
  );
};

export default WaveScrollbar;
