'use client';

import type { ItineraryItem } from '@/lib/types';

const SLOTS: ItineraryItem['slot'][] = ['Morning', 'Afternoon', 'Evening'];

interface Props {
  item: ItineraryItem;
  dayCount: number;
  onMove: (day: number, slot: ItineraryItem['slot']) => void;
}

// Tap-to-move for screens where dragging isn't available (touch): pick a day and/or a time
// of day and the place moves there straight away.
export function MovePanel({ item, dayCount, onMove }: Props) {
  const chip = (active: boolean) =>
    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors ' +
    (active ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100');

  return (
    <div
      className="mt-2 p-2 rounded-lg bg-gray-50 border border-gray-200 flex flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {dayCount > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 text-[11px] font-semibold text-gray-500 uppercase">Day</span>
          {Array.from({ length: Math.max(dayCount, item.day) }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" onClick={() => onMove(d, item.slot)} className={chip(d === item.day)}>
              {d}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-10 text-[11px] font-semibold text-gray-500 uppercase">When</span>
        {SLOTS.map((slot) => (
          <button key={slot} type="button" onClick={() => onMove(item.day, slot)} className={chip(slot === item.slot)}>
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
}
