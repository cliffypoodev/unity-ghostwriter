import React, { useRef, useState, useEffect } from "react";

const COVER_W = 155;
const SPINE_W = 26;
const TOTAL_W = COVER_W * 2 + SPINE_W;
const COVER_H = 480;

export default function CoverCanvas({
  elements,
  selectedId,
  onSelect,
  onMove,
  onDoubleClick,
  bgBack,
  bgFront,
  spineText,
  spineDirection,
  showGuides,
}) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e, el) => {
    e.stopPropagation();
    onSelect(el.id);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left - el.x, y: e.clientY - rect.top - el.y });
    setDragging(el.id);
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    onMove(dragging, x, y);
  };

  const handleMouseUp = () => setDragging(null);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, dragOffset]);

  return (
    <div
      ref={canvasRef}
      className="relative select-none border"
      style={{
        width: TOTAL_W * 2,
        height: COVER_H,
        background: "var(--pgAlt)",
        borderColor: "var(--nb-border)",
        overflow: "hidden",
        transform: "scale(1)",
        transformOrigin: "top left",
      }}
      onClick={() => onSelect(null)}
    >
      {/* Back cover */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: COVER_W * 2,
          height: COVER_H,
          background: bgBack || "var(--pg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          ...(bgBack?.startsWith("http") ? { backgroundImage: `url(${bgBack})` } : {}),
        }}
      />

      {/* Spine */}
      <div
        className="absolute top-0 flex items-center justify-center"
        style={{
          left: COVER_W * 2,
          width: SPINE_W * 2,
          height: COVER_H,
          background: "var(--nb-border)",
        }}
      >
        {spineText && (
          <span
            className="text-xs font-semibold whitespace-nowrap"
            style={{
              writingMode: spineDirection === "btt" ? "vertical-rl" : "vertical-rl",
              transform: spineDirection === "btt" ? "rotate(180deg)" : "none",
              color: "var(--ink)",
              letterSpacing: "1px",
            }}
          >
            {spineText}
          </span>
        )}
      </div>

      {/* Front cover */}
      <div
        className="absolute top-0"
        style={{
          left: (COVER_W + SPINE_W) * 2,
          width: COVER_W * 2,
          height: COVER_H,
          background: bgFront || "var(--pg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          ...(bgFront?.startsWith("http") ? { backgroundImage: `url(${bgFront})` } : {}),
        }}
      />

      {/* Guidelines */}
      {showGuides && (
        <>
          {/* Bleed lines */}
          <div className="absolute inset-0 border-2 border-dashed border-red-300/40 pointer-events-none" />
          {/* Trim lines */}
          <div className="absolute pointer-events-none" style={{ top: 8, left: 8, right: 8, bottom: 8, border: "1px dashed rgba(0,120,255,0.3)" }} />
          {/* Safe zone */}
          <div className="absolute pointer-events-none" style={{ top: 20, left: 20, right: 20, bottom: 20, border: "1px dashed rgba(0,200,100,0.3)" }} />
          {/* Spine boundaries */}
          <div className="absolute pointer-events-none" style={{ top: 0, bottom: 0, left: COVER_W * 2, width: 1, background: "rgba(255,100,0,0.4)" }} />
          <div className="absolute pointer-events-none" style={{ top: 0, bottom: 0, left: (COVER_W + SPINE_W) * 2, width: 1, background: "rgba(255,100,0,0.4)" }} />
        </>
      )}

      {/* Draggable elements */}
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute cursor-move"
          style={{
            left: el.x,
            top: el.y,
            border: selectedId === el.id ? "2px solid var(--accent)" : "1px solid transparent",
            borderRadius: 4,
            padding: 4,
            minWidth: 40,
            minHeight: 20,
            zIndex: selectedId === el.id ? 10 : 1,
          }}
          onMouseDown={(e) => handleMouseDown(e, el)}
          onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(el.id); }}
        >
          {el.type === "text" && (
            <span
              style={{
                fontSize: el.fontSize || 16,
                fontWeight: el.bold ? "bold" : "normal",
                fontStyle: el.italic ? "italic" : "normal",
                color: el.color || "var(--ink)",
                fontFamily: el.font || "Georgia, serif",
                whiteSpace: "pre-wrap",
              }}
            >
              {el.text || "Double-click to edit"}
            </span>
          )}
          {el.type === "image" && el.src && (
            <img
              src={el.src}
              alt=""
              style={{ width: el.width || 120, height: el.height || 160, objectFit: "cover", borderRadius: 4 }}
              draggable={false}
            />
          )}
        </div>
      ))}
    </div>
  );
}