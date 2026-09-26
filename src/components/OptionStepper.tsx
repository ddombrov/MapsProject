'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface StepperOption {
  value: string;
  label: string;
  color?: string;
}

interface Props {
  options: StepperOption[];
  value: string;
  onChange: (value: string) => void;
  title?: string;
}

// "‹ All Days ›": the arrows step through the options and wrap around at either end, and
// clicking the label opens the whole list (with each option's color swatch, if it has one).
export function OptionStepper({ options, value, onChange, title }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index];

  return (
    <div className="relative flex items-center bg-gray-100 rounded-md" ref={ref} title={title}>
      <button
        type="button"
        onClick={() => onChange(options[(index - 1 + options.length) % options.length].value)}
        className="p-1.5 pointer-coarse:p-3 text-gray-500 hover:text-gray-800"
        aria-label="Previous"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center gap-1.5 min-w-24 px-1 py-1.5 pointer-coarse:py-3 text-xs font-medium text-gray-700"
      >
        {current.color && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: current.color }} />}
        {current.label}
        <ChevronDown size={11} className="text-gray-400" />
      </button>
      <button
        type="button"
        onClick={() => onChange(options[(index + 1) % options.length].value)}
        className="p-1.5 pointer-coarse:p-3 text-gray-500 hover:text-gray-800"
        aria-label="Next"
      >
        <ChevronRight size={14} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-full bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={
                'w-full flex items-center gap-1.5 text-left px-3 py-2 text-xs hover:bg-gray-50 ' +
                (option.value === value ? 'font-semibold text-primary' : 'text-gray-700')
              }
            >
              {option.color && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: option.color }} />}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
