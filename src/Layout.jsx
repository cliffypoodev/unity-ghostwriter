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
import { BookOpen, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
          
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setIsMobileMode(!isMobileMode)}
              className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Toggle mobile view"
            >
              <span className="text-xs font-medium text-slate-600">
                {isMobileMode ? 'Mobile' : 'Desktop'}
              </span>
              <div className={`w-9 h-5 rounded-full transition-colors ${isMobileMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform transform ${isMobileMode ? 'translate-x-4' : 'translate-x-0.5'}`} style={{ marginTop: '2px' }} />
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Menu">
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
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('deleteProject'))} className="text-red-600">
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}