'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SourceWeights, SourceConfig } from '@/lib/types';

interface Props {
  value: SourceWeights;
  onChange: (weights: SourceWeights) => void;
  config: SourceConfig | null;
}

const SOURCES: {
  key: keyof SourceWeights;
  label: string;
  configKey?: keyof SourceConfig;
  disabledNote?: string;
}[] = [
  { key: 'google', label: 'Google Places' },
  {
    key: 'reddit',
    label: 'Reddit',
    configKey: 'reddit',
    disabledNote: 'Needs a free Reddit app — see the README for setup steps.',
  },
  {
    key: 'ticketmaster',
    label: 'Ticketmaster (events)',
    configKey: 'ticketmaster',
    disabledNote: 'Needs a free Ticketmaster key — see the README for setup steps.',
  },
];

export function SourceWeightSliders({ value, onChange, config }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isDisabled = (key: keyof SourceWeights) => {
    const configKey = SOURCES.find((s) => s.key === key)?.configKey;
    return configKey ? !(config?.[configKey] ?? false) : false;
  };
  const enabledKeys = SOURCES.map((s) => s.key).filter((k) => !isDisabled(k));

  // Each slider's stored value IS its percentage share (they always sum to 100 among
  // enabled sources), so the thumb position and the displayed percentage never disagree.
  // Dragging one slider proportionally redistributes the rest, like a budget allocator.
  const handleChange = (key: keyof SourceWeights, newValue: number) => {
    const otherKeys = enabledKeys.filter((k) => k !== key);
    const remaining = 100 - newValue;
    const next: SourceWeights = { ...value, [key]: newValue };

    if (otherKeys.length === 0) {
      onChange(next);
      return;
    }

    const currentOtherTotal = otherKeys.reduce((sum, k) => sum + value[k], 0);
    if (currentOtherTotal <= 0) {
      const share = remaining / otherKeys.length;
      otherKeys.forEach((k) => { next[k] = share; });
    } else {
      otherKeys.forEach((k) => { next[k] = (value[k] / currentOtherTotal) * remaining; });
    }

    onChange(next);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Source Emphasis</span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-1.5 flex flex-col gap-2">
          {SOURCES.map(({ key, label, disabledNote }) => {
            const disabled = isDisabled(key);
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className={disabled ? 'text-gray-300' : 'text-gray-600'}>{label}</span>
                  <span className="text-gray-400">{disabled ? 0 : Math.round(value[key])}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={disabled ? 0 : value[key]}
                  disabled={disabled}
                  onChange={(e) => handleChange(key, Number(e.target.value))}
                  className="w-full disabled:opacity-40 disabled:cursor-not-allowed"
                />
                {disabled && disabledNote && <p className="text-[10px] text-gray-400 mt-0.5">{disabledNote}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
