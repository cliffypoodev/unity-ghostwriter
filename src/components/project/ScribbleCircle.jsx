import React, { useRef, useEffect, useState } from "react";

const SCRIBBLE_PATH = "M10,35 C10,10 40,2 90,2 C140,2 170,10 170,35 C170,60 140,68 90,68 C40,68 10,60 10,35 C10,22 32,8 60,5";

export default function ScribbleCircle({ active, children, className = "" }) {
  const pathRef = useRef(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, []);

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {children}
      <svg
        viewBox="0 0 180 70"
        className="absolute inset-0 pointer-events-none"
        style={{
          left: "-28px",
          right: "-28px",
          top: "-14px",
          bottom: "-14px",
          width: "calc(100% + 56px)",
          height: "calc(100% + 28px)",
        }}
        preserveAspectRatio="none"
      >
        <path
          ref={pathRef}
          d={SCRIBBLE_PATH}
          fill="none"
          stroke="var(--accent, #5DCAA5)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: length || 500,
            strokeDashoffset: active ? 0 : (length || 500),
            transition: active
              ? "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)"
              : "none",
          }}
        />
      </svg>
    </span>
  );
}