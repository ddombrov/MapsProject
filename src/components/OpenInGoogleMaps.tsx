'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Navigation } from 'lucide-react';

export interface DayMapsLink {
  day: number;
  color: string;
  url: string;
}

interface Props {
  links: DayMapsLink[];
  selectedDay: 'all' | number;
  singleDay: boolean;
}

const buttonClass =
  'flex items-center gap-1.5 text-xs px-3 py-2 pointer-coarse:py-3 rounded-lg shadow-md bg-white text-gray-700 hover:bg-gray-50 font-medium';

// Google Maps can only draw one route at a time, so with several days in view this offers
// one link per day; with a single day (chosen, or the only one) it's a direct link.
export function OpenInGoogleMaps({ links, selectedDay, singleDay }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visible = selectedDay === 'all' ? links : links.filter((l) => l.day === selectedDay);
  if (visible.length === 0) return null;

  if (visible.length === 1) {
    return (
      <a href={visible[0].url} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        <Navigation size={14} /> Open in Google Maps
      </a>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={buttonClass}>
        <Navigation size={14} /> Open in Google Maps <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-full min-w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
          {visible.map((link) => (
            <a
              key={link.day}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 px-3 py-2 pointer-coarse:py-3 text-xs text-gray-700 hover:bg-gray-50"
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: link.color }} />
              {singleDay ? 'Open route' : `Day ${link.day}`}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
