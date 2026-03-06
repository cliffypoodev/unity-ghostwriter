import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen } from "lucide-react";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-slate-800">Book Generation Platform</span>
          </Link>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}