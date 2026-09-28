'use client';

import { useState } from 'react';
import type { ItineraryItem } from '@/lib/types';
import { sourcesForItem } from '@/lib/sources';
import { hoursNoteForItem } from '@/lib/openingHours';
import { MovePanel } from '@/components/MovePanel';

interface Props {
  item: ItineraryItem;
  onEdit?: (item: ItineraryItem) => void;
  onMove?: (item: ItineraryItem, day: number, slot: ItineraryItem['slot']) => void;
  dayCount?: number;
  showDay?: boolean;
  startDate?: string;
}

const linkClass =
  'text-[10px] font-semibold text-gray-400 hover:text-primary underline decoration-dotted pointer-coarse:text-xs pointer-coarse:py-1.5 pointer-coarse:px-1';

export function SpotDetail({ item, onEdit, onMove, dayCount = 1, showDay = true, startDate }: Props) {
  const [moving, setMoving] = useState(false);
  const hours = hoursNoteForItem(item, startDate);

  return (
    <div className="p-2 max-w-xs font-sans">
      <div className="flex items-center justify-between mb-0.5 pr-7">
        <div className="text-[10px] font-bold text-primary uppercase tracking-wider">
          {showDay ? `Day ${item.day} • ` : ''}{item.slot}
        </div>
        <div className="flex items-center gap-2">
          {onMove && (
            <button type="button" onClick={() => setMoving((v) => !v)} className={linkClass}>
              Move
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={() => onEdit(item)} className={linkClass}>
              Edit
            </button>
          )}
        </div>
      </div>
      {moving && onMove && (
        <MovePanel
          item={item}
          dayCount={dayCount}
          onMove={(day, slot) => {
            setMoving(false);
            onMove(item, day, slot);
          }}
        />
      )}
      <h4 className="font-bold text-sm text-gray-800 mb-1 mt-1">{item.name}</h4>
      <p className="text-xs text-gray-500 mb-2">{item.address}</p>
      {hours && (
        <div className="text-[11px] mb-2">
          {hours.dayText && <p className="text-gray-500">🕒 {hours.dayText}</p>}
          {hours.warning && <p className="text-amber-600 font-medium">⚠️ {hours.warning}</p>}
        </div>
      )}
      <p className="text-xs text-gray-700 leading-normal">{item.notes}</p>
      {item.reviewHighlights && item.reviewHighlights.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {item.reviewHighlights.map((quote, i) => (
            <p key={i} className="text-[11px] italic text-gray-500">&ldquo;{quote}&rdquo;</p>
          ))}
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-2">Sources: {sourcesForItem(item)}</p>
    </div>
  );
}
