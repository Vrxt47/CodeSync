"use client";

import React, { useCallback, useRef, useEffect } from "react";

export interface ResizeHandleProps {
  currentHeight: number;
  onResize: (height: number) => void;
  minHeight?: number;
  maxHeightRatio?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  currentHeight,
  onResize,
  minHeight = 140,
  maxHeightRatio = 0.65,
  containerRef,
  className = "",
}) => {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Restore cursor and selection on component unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Primary button only
      if (e.button !== 0) return;
      e.preventDefault();

      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = currentHeight;

      // Prevent text selection and force row-resize cursor across the viewport
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current) return;

        // Dragging upward (negative delta clientY) increases bottom panel height
        const deltaY = startYRef.current - moveEvent.clientY;
        const targetHeight = startHeightRef.current + deltaY;

        // Calculate maximum height based on available workspace container height
        const containerHeight = containerRef?.current?.clientHeight || window.innerHeight || 800;
        const maxHeight = Math.floor(containerHeight * maxHeightRatio);

        // Clamp between minHeight and maxHeight
        const clampedHeight = Math.min(
          Math.max(targetHeight, minHeight),
          Math.max(minHeight, maxHeight)
        );
        onResize(clampedHeight);
      };

      const handlePointerUp = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        // Restore normal cursor and text selection
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [currentHeight, onResize, minHeight, maxHeightRatio, containerRef]
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`h-1.5 w-full bg-[#303030]/50 hover:bg-[#007ACC] active:bg-[#007ACC] cursor-row-resize transition-colors shrink-0 z-20 flex items-center justify-center group ${className}`}
      title="Drag to resize panel (Min: 140px, Max: 65%)"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize execution panel"
    >
      {/* Visual drag grip indicator */}
      <div className="w-8 h-0.5 rounded-full bg-white/20 group-hover:bg-white/60 transition-colors" />
    </div>
  );
};
