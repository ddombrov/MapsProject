'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ItineraryItem } from '@/lib/types';

import { formatTripDate } from '@/lib/dates';

interface Props {
  days: number;
  // When the trip's dates are known, days are shown as real dates, not just "Day 4".
  startDate?: string;
  onAdd: (item: ItineraryItem) => void;
  onClose: () => void;
  initial?: { address?: string; lat?: number; lng?: number; name?: string; day?: number };
  editItem?: ItineraryItem | null;
}

export function AddPlaceModal({ days, startDate, onAdd, onClose, initial, editItem }: Props) {
  const [name, setName] = useState(editItem?.name ?? initial?.name ?? '');
  const [address, setAddress] = useState(editItem?.address ?? initial?.address ?? '');
  const [day, setDay] = useState(editItem?.day ?? initial?.day ?? 1);
  const [slot, setSlot] = useState<ItineraryItem['slot']>(editItem?.slot ?? 'Morning');
  const [category, setCategory] = useState<ItineraryItem['category']>(editItem?.category ?? 'Attraction');
  const [notes, setNotes] = useState(editItem?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFixedCoords = !editItem && initial?.lat !== undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let lat = editItem && address === editItem.address ? editItem.lat : initial?.lat;
      let lng = editItem && address === editItem.address ? editItem.lng : initial?.lng;
      let resolvedAddress = address;

      if (lat === undefined || lng === undefined) {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const data: { lat: number; lng: number; formattedAddress: string; error?: string } = await res.json();
        if (!res.ok) {
          setError(data.error || 'Could not find that address');
          setLoading(false);
          return;
        }
        lat = data.lat;
        lng = data.lng;
        resolvedAddress = data.formattedAddress;
      }

      onAdd({
        day,
        slot,
        category,
        name: name.trim(),
        address: resolvedAddress,
        lat,
        lng,
        notes: notes.trim() || 'Added manually.',
      });
      onClose();
    } catch {
      setError('Failed to save place');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{editItem ? 'Edit Place' : 'Add a Place'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 pointer-coarse:p-2">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            required
          />
        </div>

        {!hasFixedCoords && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="e.g. 123 Main St, Halifax, NS"
              required
            />
          </div>
        )}

        {hasFixedCoords && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Address</label>
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">{address}</p>
            <p className="text-[10px] text-gray-400 mt-1">Dropped from the map. Close this and click a different spot to change it.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Day</label>
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {Array.from({ length: Math.max(days, day, 1) }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{startDate ? formatTripDate(startDate, d) + ' (Day ' + d + ')' : 'Day ' + d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Slot</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as ItineraryItem['slot'])}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ItineraryItem['category'])}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="Food">Food</option>
            <option value="Attraction">Attraction</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            rows={2}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving…' : editItem ? 'Save Changes' : 'Add to Itinerary'}
        </button>
      </form>
    </div>
  );
}
