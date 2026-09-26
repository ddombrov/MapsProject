'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface CategorySelection {
  items: string[];
  strict: boolean;
}

interface Props {
  label: string;
  options: string[];
  value: CategorySelection;
  onChange: (next: CategorySelection) => void;
}

export function CategoryPreferenceGroup({ label, options, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggleChecked = (opt: string) => {
    onChange({
      ...value,
      items: value.items.includes(opt) ? value.items.filter((i) => i !== opt) : [...value.items, opt],
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          {label}
          {value.items.length > 0 && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
              {value.items.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-end">
            <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => onChange({ ...value, strict: false })}
                title="Include a few matching spots, but don't limit to only these"
                className={`px-2 py-0.5 rounded-full font-medium ${!value.strict ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
              >
                If possible
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, strict: true })}
                title="Only find places matching these values"
                className={`px-2 py-0.5 rounded-full font-medium ${value.strict ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}
              >
                Only these
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {options.map((opt) => {
              const checked = value.items.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-2 text-xs px-1 py-1 cursor-pointer ${
                    !checked
                      ? 'text-gray-500'
                      : value.strict
                        ? 'text-red-700 font-medium'
                        : 'text-primary font-medium'
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleChecked(opt)} className="cursor-pointer" />
                  {opt}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
