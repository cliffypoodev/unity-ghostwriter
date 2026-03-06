import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Home } from "lucide-react";

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to={createPageUrl("Home")} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                BookForge
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                to={createPageUrl("Home")}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60 transition-all"
              >
                <Home className="w-4 h-4" />
                Projects
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}