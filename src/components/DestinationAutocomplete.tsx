'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function DestinationAutocomplete({ value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetching is driven directly by the input's onChange, not by watching the `value`
  // prop — that way selecting a suggestion or an external update (e.g. the Randomize
  // button) never re-triggers a fetch or reopens the dropdown, only actual typing does.
  const fetchSuggestions = (input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/autocomplete?input=${encodeURIComponent(input)}`)
        .then((res) => res.json())
        .then((data) => {
          setSuggestions(data.suggestions || []);
          setOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none bg-white"
        placeholder="e.g. Tampa, FL"
        required
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setSuggestions([]);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
