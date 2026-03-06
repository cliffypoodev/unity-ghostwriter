import React from "react";

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-indigo-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mb-5">{description}</p>}
      {action}
    </div>
  );
}