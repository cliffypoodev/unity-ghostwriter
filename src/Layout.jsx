import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen } from "lucide-react";

export default function Layout({ children }) {
  const [isMobileMode, setIsMobileMode] = useState(false);

  return (
    <div className={`min-h-screen bg-slate-50 ${isMobileMode ? 'mobile' : ''}`}>
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-slate-800">Book Generation Platform</span>
          </Link>
          
          <button
            onClick={() => setIsMobileMode(!isMobileMode)}
            className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Toggle mobile view"
          >
            <span className="text-xs font-medium text-slate-600">
              {isMobileMode ? 'Mobile' : 'Desktop'}
            </span>
            <div className={`w-9 h-5 rounded-full transition-colors ${isMobileMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform transform ${isMobileMode ? 'translate-x-4' : 'translate-x-0.5'}`} style={{ marginTop: '2px' }} />
            </div>
          </button>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}