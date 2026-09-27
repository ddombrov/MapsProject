'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SourceWeights, SourceConfig } from '@/lib/types';

interface Props {
  value: SourceWeights;
  onChange: (weights: SourceWeights) => void;
  config: SourceConfig | null;
  // The AI row isn't part of the 0-100 weight budget the others share — it's the existing
  // hidden-gem toggle, surfaced here as a source alongside Google/Reddit/Ticketmaster since
  // it's also a knob on how the model chooses among the candidate places.
  aiEnabled: boolean;
  onAiChange: (enabled: boolean) => void;
}

const SOURCES: {
  key: keyof SourceWeights;
  label: string;
  configKey?: keyof SourceConfig;
  disabledNote?: string;
  note?: string;
}[] = [
  { key: 'google', label: 'Google Places' },
  {
    key: 'reddit',
    label: 'Reddit',
    // Not gated on server config: Reddit itself blocks most automated search traffic
    // (its unauthenticated search now redirects to a login wall), so results are
    // inherently sparse regardless of whether an app key is set up. Capped low rather
    // than hidden, since it can still turn up a real mention worth surfacing.
    note: 'Capped at 25% — Reddit blocks most automated search traffic, so results can be limited.',
  },
  {
    key: 'ticketmaster',
    label: 'Ticketmaster (events)',
    configKey: 'ticketmaster',
    disabledNote: 'Needs a free Ticketmaster key — see the README for setup steps.',
  },
];

// Community sentiment is a garnish, not a foundation, so Reddit can't take more than this share.
const MAX_SHARE: Partial<Record<keyof SourceWeights, number>> = { reddit: 25 };
const maxShare = (key: keyof SourceWeights) => MAX_SHARE[key] ?? 100;

// Sets `key` to `requested` and spreads the remainder over the other enabled sources in
// proportion to their current shares, never letting a capped source exceed its cap (the
// overflow goes to the sources that still have room).
export function rebalance(
  value: SourceWeights,
  key: keyof SourceWeights,
  requested: number,
  enabledKeys: (keyof SourceWeights)[],
): SourceWeights {
  const otherKeys = enabledKeys.filter((k) => k !== key);
  // The others can only absorb so much, which puts a floor under this slider.
  const absorbable = otherKeys.reduce((sum, k) => sum + maxShare(k), 0);
  const newValue = Math.min(maxShare(key), Math.max(requested, 100 - absorbable));
  const next: SourceWeights = { ...value, [key]: newValue };

  if (otherKeys.length === 0) return next;

  const remaining = 100 - newValue;
  const currentOtherTotal = otherKeys.reduce((sum, k) => sum + value[k], 0);
  otherKeys.forEach((k) => {
    next[k] = currentOtherTotal > 0 ? (value[k] / currentOtherTotal) * remaining : remaining / otherKeys.length;
  });

  for (let pass = 0; pass < otherKeys.length; pass++) {
    const over = otherKeys.filter((k) => next[k] > maxShare(k) + 1e-9);
    if (over.length === 0) break;
    let excess = 0;
    over.forEach((k) => {
      excess += next[k] - maxShare(k);
      next[k] = maxShare(k);
    });
    const room = otherKeys.filter((k) => !over.includes(k) && next[k] < maxShare(k));
    const roomTotal = room.reduce((sum, k) => sum + next[k], 0);
    room.forEach((k) => {
      next[k] += roomTotal > 0 ? (excess * next[k]) / roomTotal : excess / room.length;
    });
  }

  return next;
}

export function SourceWeightSliders({ value, onChange, config, aiEnabled, onAiChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isDisabled = (key: keyof SourceWeights) => {
    const configKey = SOURCES.find((s) => s.key === key)?.configKey;
    return configKey ? !(config?.[configKey] ?? false) : false;
  };
  const enabledKeys = SOURCES.map((s) => s.key).filter((k) => !isDisabled(k));

  // Each slider's stored value IS its percentage share (they always sum to 100 among
  // enabled sources), so the thumb position and the displayed percentage never disagree.
  // Dragging one slider proportionally redistributes the rest, like a budget allocator.
  const handleChange = (key: keyof SourceWeights, requested: number) => {
    onChange(rebalance(value, key, requested, enabledKeys));
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
          {SOURCES.map(({ key, label, disabledNote, note }) => {
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
                  max={maxShare(key)}
                  value={disabled ? 0 : value[key]}
                  disabled={disabled}
                  onChange={(e) => handleChange(key, Number(e.target.value))}
                  className="w-full disabled:opacity-40 disabled:cursor-not-allowed"
                />
                {disabled && disabledNote && <p className="text-[10px] text-gray-400 mt-0.5">{disabledNote}</p>}
                {!disabled && note && <p className="text-[10px] text-gray-400 mt-0.5">{note}</p>}
              </div>
            );
          })}

          <div>
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span className="text-gray-600">AI (hidden gems)</span>
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => onAiChange(e.target.checked)}
              />
            </label>
            <p className="text-[10px] text-gray-400 mt-0.5">
              When on, the model favors hidden gems and local favorites over obvious tourist spots.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
