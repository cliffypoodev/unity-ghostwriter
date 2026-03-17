import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

// ⚠️ DO NOT REMOVE — Global scroll reset. Fixes scroll-to-bottom bug on navigation.
// This component must remain inside the Layout (Router context) at all times.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

import { createPageUrl } from "@/utils";
import { Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Layout({ children }) {
  const [isMobileMode, setIsMobileMode] = useState(false);

  return (
    <div className={`min-h-screen bg-slate-50 overflow-x-hidden ${isMobileMode ? 'mobile' : ''}`}>
      <ScrollToTop />
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-2">
          
          {/* Logo — shrinks gracefully on small screens */}
          <Link 
            to={createPageUrl("Home")} 
            className="flex items-center gap-2 min-w-0 shrink hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69aadec3c961db7ad00f82dc/9e2525f51_image.png"
              alt="Unity Ghostwriter"
              className="w-8 h-8 shrink-0 rounded-lg"
            />
            <span className="text-sm sm:text-base font-semibold text-slate-800 truncate">
              Unity Ghostwriter
            </span>
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Controls — always visible, compact on mobile */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Mobile/Desktop toggle */}
            <button
              onClick={() => setIsMobileMode(!isMobileMode)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
              aria-label="Toggle mobile view"
            >
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 select-none">
                {isMobileMode ? 'Mobile' : 'Desktop'}
              </span>
              <div 
                className={`w-9 h-5 rounded-full transition-colors relative ${isMobileMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div 
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isMobileMode ? 'translate-x-4' : 'translate-x-0.5'}`} 
                />
              </div>
            </button>

            {/* Hamburger menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="p-2.5 -mr-1 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors touch-manipulation" 
                  aria-label="Menu"
                >
                  <Menu className="w-5 h-5 text-slate-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('saveProject'))}>
                  Save
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("Settings")}>Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.dispatchEvent(new CustomEvent('deleteProject'))} 
                  className="text-red-600"
                >
                  Delete Project
                </DropdownMenuItem>
                <div className="px-2 py-1.5 border-t border-slate-100 mt-1">
                  <span className="text-[10px] text-slate-400 font-mono">v13.1</span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-4 sm:py-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}