import React from "react";
import HomeTab from "../components/project/HomeTab";

export default function Home() {
  return (
    <div className="notebook-shell" style={{ marginTop: "8px" }}>
      {/* Spine */}
      <div className="notebook-spine" />

      {/* Body — single notebook page for Home */}
      <div className="notebook-body">
        <div className="nb-margin-line" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <HomeTab />
        </div>
      </div>
    </div>
  );
}