'use client';

import { X } from 'lucide-react';
import type { ItineraryItem } from '@/lib/types';
import { SpotDetail } from '@/components/SpotDetail';

interface Props {
  item: ItineraryItem | null;
  onClose: () => void;
  onEdit?: (item: ItineraryItem) => void;
  onMove?: (item: ItineraryItem, day: number, slot: ItineraryItem['slot']) => void;
  dayCount?: number;
  showDay?: boolean;
  startDate?: string;
}

export function SpotModal({ item, onClose, onEdit, onMove, dayCount, showDay, startDate }: Props) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end p-1.5">
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
            <X size={18} />
          </button>
        </div>
        <div className="px-3 pb-4 -mt-2">
          <SpotDetail
            item={item}
            onEdit={onEdit}
            onMove={onMove}
            dayCount={dayCount}
            showDay={showDay}
            startDate={startDate}
          />
        </div>
      </div>
    </div>
  );
}
