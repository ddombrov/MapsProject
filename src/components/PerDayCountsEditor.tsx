'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DayCounts } from '@/lib/types';

interface Props {
  value: DayCounts[];
  onChange: (counts: DayCounts[]) => void;
}

export function PerDayCountsEditor({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const totalFood = value.reduce((sum, d) => sum + d.food, 0);
  const totalAttraction = value.reduce((sum, d) => sum + d.attraction, 0);

  const updateDay = (idx: number, patch: Partial<DayCounts>) => {
    const next = [...value];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          Spots Per Day
          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
            {totalFood + totalAttraction}
          </span>
        </span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-1.5">
          <div className="flex flex-col gap-1.5">
            {value.map((day, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="w-14 text-gray-600 font-medium">Day {idx + 1}</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={day.food}
                  onChange={(e) => updateDay(idx, { food: Number(e.target.value) })}
                  className="w-16 p-1.5 border border-gray-300 rounded-md text-gray-900 text-center"
                  title="Food spots"
                />
                <span className="text-xs text-gray-400">food</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={day.attraction}
                  onChange={(e) => updateDay(idx, { attraction: Number(e.target.value) })}
                  className="w-16 p-1.5 border border-gray-300 rounded-md text-gray-900 text-center"
                  title="Attraction spots"
                />
                <span className="text-xs text-gray-400">attraction</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {totalFood + totalAttraction} total spots ({totalFood} food, {totalAttraction} attraction)
          </p>
        </div>
      )}
    </div>
  );
}
