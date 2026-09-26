'use client';

import { useState, type ReactNode } from 'react';
import type { ItineraryItem } from '@/lib/types';
import { sourcesForItem } from '@/lib/sources';
import { hoursNoteForItem } from '@/lib/openingHours';
import { getSpotEmoji } from '@/lib/spotEmoji';
import { dayColor } from '@/lib/dayColor';
import {
  startItemDrag,
  isItineraryDrag,
  readDraggedIndex,
  dropPosition,
  type MoveTarget,
  type DropPosition,
} from '@/lib/dragDrop';

const SLOT_ORDER: Record<ItineraryItem['slot'], number> = { Morning: 0, Afternoon: 1, Evening: 2 };

interface Props {
  itinerary: ItineraryItem[];
  selectedSpot: ItineraryItem | null;
  onSelect: (item: ItineraryItem) => void;
  actions?: ReactNode;
  onMoveItem?: (from: number, target: MoveTarget) => void;
  showDay?: boolean;
  startDate?: string;
}

export function TableView({ itinerary, selectedSpot, onSelect, actions, onMoveItem, showDay = true, startDate }: Props) {
  const [dropTarget, setDropTarget] = useState<{ item: ItineraryItem; position: DropPosition } | null>(null);

  const rows = [...itinerary].sort((a, b) => a.day - b.day || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      {actions && <div className="flex justify-end">{actions}</div>}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              {showDay && <th className="px-4 py-3 text-left font-semibold">Day</th>}
              <th className="px-4 py-3 text-left font-semibold">When</th>
              <th className="px-4 py-3 text-left font-semibold">Place</th>
              <th className="px-4 py-3 text-left font-semibold">Notes</th>
              <th className="px-4 py-3 text-left font-semibold">Sources</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((item, idx) => {
              const hours = hoursNoteForItem(item, startDate);
              const selected = selectedSpot?.name === item.name;

              return (
                <tr
                  key={idx}
                  draggable={!!onMoveItem}
                  onDragStart={(e) => startItemDrag(e, itinerary.indexOf(item))}
                  onDragOver={(e) => {
                    if (!onMoveItem || !isItineraryDrag(e)) return;
                    e.preventDefault();
                    const position = dropPosition(e);
                    setDropTarget((prev) => (prev?.item === item && prev.position === position ? prev : { item, position }));
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                  }}
                  onDrop={(e) => {
                    const from = readDraggedIndex(e);
                    const position = dropPosition(e);
                    setDropTarget(null);
                    if (!onMoveItem || from === null) return;
                    e.preventDefault();
                    onMoveItem(from, { kind: 'item', anchor: item, position });
                  }}
                  onDragEnd={() => setDropTarget(null)}
                  onClick={() => onSelect(item)}
                  style={
                    dropTarget?.item === item
                      ? { boxShadow: dropTarget.position === 'before' ? 'inset 0 3px 0 0 #1b2a41' : 'inset 0 -3px 0 0 #1b2a41' }
                      : undefined
                  }
                  className={
                    'cursor-pointer transition-colors ' +
                    (selected ? 'bg-primary/10' : 'odd:bg-white even:bg-gray-50 hover:bg-primary/5')
                  }
                >
                  {showDay && (
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-semibold"
                        style={{ backgroundColor: dayColor(item.day) }}
                      >
                        Day {item.day}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 align-top whitespace-nowrap text-gray-600">
                    {item.slot}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none mt-0.5" title={item.category}>
                        {getSpotEmoji(item)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-800">
                          {item.name}
                          {hours?.warning && (
                            <span className="ml-2 text-xs font-medium text-amber-600">⚠️ {hours.warning}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.address}</div>
                        {hours?.dayText && <div className="text-xs text-gray-400 mt-0.5">🕒 {hours.dayText}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-600 max-w-xs">{item.notes}</td>
                  <td className="px-4 py-3 align-top text-gray-400 text-xs">{sourcesForItem(item)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
