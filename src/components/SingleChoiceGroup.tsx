'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}

export function SingleChoiceGroup({ label, options, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1">
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <label
                key={opt}
                className={`flex items-center gap-2 text-xs px-1 py-1 cursor-pointer ${
                  selected ? 'text-primary font-medium' : 'text-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name={label}
                  checked={selected}
                  onChange={() => onChange(opt)}
                  className="cursor-pointer"
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
