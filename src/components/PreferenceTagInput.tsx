'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { CategorySelection } from '@/components/CategoryPreferenceGroup';

interface Props {
  value: CategorySelection;
  onChange: (next: CategorySelection) => void;
  children?: ReactNode;
}

export function PreferenceTagInput({ value, onChange, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');

  const addTag = () => {
    const trimmed = text.trim();
    if (!trimmed || value.items.includes(trimmed)) return;
    onChange({ ...value, items: [...value.items, trimmed] });
    setText('');
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          Other Preferences
          {value.items.length > 0 && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
              {value.items.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-1.5">
          <div className="flex items-center justify-end mb-1.5">
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
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none bg-white"
              placeholder="e.g. accessible entrances, quiet neighborhood"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium"
            >
              Add
            </button>
          </div>

          {value.items.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.items.map((item) => (
                <span
                  key={item}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                    value.strict ? 'bg-red-50 border-red-200 text-red-700' : 'bg-primary/5 border-primary/20 text-primary'
                  }`}
                >
                  {item}
                  <button type="button" onClick={() => onChange({ ...value, items: value.items.filter((i) => i !== item) })}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {children && <div className="mt-3 pt-3 border-t border-gray-200">{children}</div>}
        </div>
      )}
    </div>
  );
}
