'use client';

import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import type { ItineraryItem } from '@/lib/types';
import { parseCsv, parseIcal, finalizeImportedRows } from '@/lib/importParsers';

interface Props {
  onImport: (items: ItineraryItem[]) => void;
  onClose: () => void;
}

export function ImportModal({ onImport, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith('.ics') ? parseIcal(text) : parseCsv(text);

      if (rows.length === 0) {
        setError('No importable rows found in this file.');
        return;
      }

      const items = await finalizeImportedRows(rows);
      if (items.length === 0) {
        setError('Could not resolve any locations from this file.');
        return;
      }

      onImport(items);
      onClose();
    } catch {
      setError('Failed to read or parse this file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Import Places</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Upload a CSV (Name, Address, Category, Notes — or a Maps/Table export from this app) or an .ics calendar file.
        </p>
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-primary text-gray-400 hover:text-primary transition-colors">
          <Upload size={24} />
          <span className="text-sm">{loading ? 'Importing…' : 'Choose a file'}</span>
          <input
            type="file"
            accept=".csv,.ics"
            className="hidden"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
