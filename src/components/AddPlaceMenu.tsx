'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Upload } from 'lucide-react';

interface Props {
  onAdd: () => void;
  onImport: () => void;
}

// One "Add Place" split button (with Import in its dropdown) shared by the map, calendar
// and table views, so all three offer exactly the same options.
export function AddPlaceMenu({ onAdd, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="flex rounded-lg shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onAdd();
          }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 pointer-coarse:py-3 bg-white text-gray-700 hover:bg-gray-50 font-medium"
        >
          <Plus size={14} /> Add Place
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 pointer-coarse:px-3 bg-white text-gray-500 hover:bg-gray-50 border-l border-gray-100"
          title="More ways to add places"
        >
          <ChevronDown size={12} />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onImport();
            }}
            className="w-full flex items-center gap-1.5 text-left px-3 py-2 pointer-coarse:py-3 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Upload size={12} /> Import
          </button>
        </div>
      )}
    </div>
  );
}
