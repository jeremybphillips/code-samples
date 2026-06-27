import { useEffect, useRef } from "react";

function useEventInBounds(event, containerRef, handler) {
  const isHoveringRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    // Track mouse enter/leave for keyboard events
    const handleMouseEnter = () => {
      isHoveringRef.current = true;
    };

    const handleMouseLeave = () => {
      isHoveringRef.current = false;
    };

    const handleEvent = (e) => {
      // For keyboard events, check if mouse is hovering over container
      if (event === "keydown" || event === "keyup" || event === "keypress") {
        if (isHoveringRef.current) {
          e.preventDefault();
          handler(e);
        }
        return;
      }

      // For other events (like wheel), check if target is within container
      const isInBounds = e.target === container || container.contains(e.target);

      if (isInBounds) {
        e.preventDefault();
        handler(e);
      }
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener(event, handleEvent, { passive: false });

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener(event, handleEvent);
    };
  }, [event, containerRef, handler]);
}

export default useEventInBounds;
