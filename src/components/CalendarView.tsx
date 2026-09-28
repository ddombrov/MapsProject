'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ItineraryItem } from '@/lib/types';
import { getSpotEmoji } from '@/lib/spotEmoji';
import { buildCalendarWeeks, buildTripDayRow, buildMonthWeeks, todayStr, toDateStr, type CalendarCell } from '@/lib/dates';
import {
  startItemDrag,
  isItineraryDrag,
  readDraggedIndex,
  dropPosition,
  type MoveTarget,
  type DropPosition,
} from '@/lib/dragDrop';

const SLOT_ORDER: Record<ItineraryItem['slot'], number> = { Morning: 0, Afternoon: 1, Evening: 2 };
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLORS: Record<ItineraryItem['category'], string> = {
  Food: '#ea580c',
  Attraction: '#2563eb',
};

export type CalendarSubView = 'day' | 'week' | 'month';

interface Props {
  itinerary: ItineraryItem[];
  startDate: string;
  days: number;
  subView: CalendarSubView;
  selectedSpot: ItineraryItem | null;
  onSelect: (item: ItineraryItem) => void;
  onPickDate?: (dateStr: string) => void;
  pickedDate?: string | null;
  onMoveItem: (from: number, target: MoveTarget) => void;
  onAddOnDay: (day: number) => void;
  actions?: ReactNode;
}

function CalendarChip({
  item,
  index,
  selected,
  onSelect,
}: {
  item: ItineraryItem;
  index: number;
  selected: boolean;
  onSelect: (item: ItineraryItem) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => startItemDrag(e, index)}
      onClick={(e) => {
        // The cell around a chip is itself clickable (to add a place), so don't let this bubble.
        e.stopPropagation();
        onSelect(item);
      }}
      title={item.name}
      className={`text-left text-[11px] leading-tight rounded px-2 py-1.5 text-white truncate ${
        selected ? 'ring-2 ring-offset-1 ring-gray-800' : ''
      }`}
      style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
    >
      {getSpotEmoji(item)} {item.name}
    </button>
  );
}

// One row of day cells. Each cell in the trip's range accepts dropped places and, when its
// empty space is clicked, opens Add Place for that day. Cells past the trip's end are shown
// lighter but still work — using one extends the trip to include that day.
function WeekGrid({
  week,
  itemsForDay,
  indexOf,
  selectedSpot,
  onSelect,
  onDropOnDay,
  onAddOnDay,
  tripLength,
  showWeekday = false,
}: {
  week: CalendarCell[];
  itemsForDay: (day: number) => ItineraryItem[];
  indexOf: (item: ItineraryItem) => number;
  selectedSpot: ItineraryItem | null;
  onSelect: (item: ItineraryItem) => void;
  onDropOnDay: (from: number, day: number) => void;
  onAddOnDay: (day: number) => void;
  tripLength: number;
  showWeekday?: boolean;
}) {
  const [overIso, setOverIso] = useState<string | null>(null);

  return (
    <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}>
      {week.map((cell) => {
        const items = cell.tripDay ? itemsForDay(cell.tripDay) : [];
        const inTrip = !!cell.tripDay && cell.tripDay <= tripLength;
        return (
          <div
            key={cell.iso}
            onClick={() => cell.tripDay && onAddOnDay(cell.tripDay)}
            onDragOver={(e) => {
              if (!cell.tripDay || !isItineraryDrag(e)) return;
              e.preventDefault();
              setOverIso(cell.iso);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIso(null);
            }}
            onDrop={(e) => {
              const from = readDraggedIndex(e);
              setOverIso(null);
              if (!cell.tripDay || from === null) return;
              e.preventDefault();
              onDropOnDay(from, cell.tripDay);
            }}
            className={`group p-2 min-h-20 md:min-h-36 flex flex-col gap-2 transition-colors ${
              cell.tripDay ? 'cursor-pointer hover:bg-primary/5' : ''
            } ${overIso === cell.iso ? 'bg-primary/10' : inTrip ? 'bg-white' : 'bg-gray-50'}`}
          >
            <span className={`text-[11px] font-medium ${inTrip && cell.inMonth !== false ? 'text-gray-500' : 'text-gray-300'}`}>
              {showWeekday ? `${cell.weekdayShort} ` : ''}{cell.monthLabel} {cell.dayOfMonth}
            </span>
            {items.map((item) => (
              <CalendarChip
                key={indexOf(item)}
                item={item}
                index={indexOf(item)}
                selected={selectedSpot?.name === item.name}
                onSelect={onSelect}
              />
            ))}
            {cell.tripDay && (
              <span className="mt-auto pt-1 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                + Add
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// A genuine, freely-navigable month calendar for picking a date before a trip exists —
// not bound to any trip's date range, unlike the trip grids below.
function PickerMonthGrid({
  anchorDate,
  onPick,
  pickedDate,
}: {
  anchorDate: string;
  onPick: (dateStr: string) => void;
  pickedDate?: string | null;
}) {
  const [viewAnchor, setViewAnchor] = useState(anchorDate);
  const viewDate = new Date(`${viewAnchor}T00:00:00`);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weeks = buildMonthWeeks(year, month);
  const todayIso = todayStr();

  const goPrev = () => {
    const d = new Date(year, month - 1, 1);
    setViewAnchor(toDateStr(d));
  };
  const goNext = () => {
    const d = new Date(year, month + 1, 1);
    setViewAnchor(toDateStr(d));
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <button type="button" onClick={goPrev} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={goNext} className="text-gray-400 hover:text-gray-600">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-1.5 text-xs font-semibold text-gray-500 text-center">{label}</div>
        ))}
      </div>
      {weeks.map((week, wIdx) => (
        <div key={wIdx} className="grid grid-cols-7 divide-x divide-gray-100 border-b border-gray-100 last:border-b-0">
          {week.map((cell) => {
            const isPast = cell.iso < todayIso;
            const isPicked = cell.iso === pickedDate;
            return (
              <button
                key={cell.iso}
                type="button"
                disabled={isPast}
                onClick={() => onPick(cell.iso)}
                className={`p-2 min-h-16 text-left transition-colors ${
                  isPicked
                    ? 'bg-primary text-white'
                    : isPast
                      ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      : !cell.inMonth
                        ? 'bg-gray-50 text-gray-300 hover:bg-gray-100'
                        : 'bg-white text-gray-700 hover:bg-primary/5'
                }`}
              >
                <span className="text-xs font-medium">{cell.dayOfMonth}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// The full calendar month containing the trip's start, however short the trip is, with the
// trip's days holding their places and the rest of the month available for adding more.
function TripMonthGrid({
  startDate,
  days,
  itemsForDay,
  indexOf,
  selectedSpot,
  onSelect,
  onDropOnDay,
  onAddOnDay,
}: {
  startDate: string;
  days: number;
  itemsForDay: (day: number) => ItineraryItem[];
  indexOf: (item: ItineraryItem) => number;
  selectedSpot: ItineraryItem | null;
  onSelect: (item: ItineraryItem) => void;
  onDropOnDay: (from: number, day: number) => void;
  onAddOnDay: (day: number) => void;
}) {
  const [viewAnchor, setViewAnchor] = useState(startDate);
  const viewDate = new Date(`${viewAnchor}T00:00:00`);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weeks = buildMonthWeeks(year, month, startDate);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setViewAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <button type="button" onClick={() => shiftMonth(-1)} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => shiftMonth(1)} className="text-gray-400 hover:text-gray-600">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-1.5 text-xs font-semibold text-gray-500 text-center">{label}</div>
        ))}
      </div>
      {weeks.map((week, wIdx) => (
        <div key={wIdx} className="border-b border-gray-100 last:border-b-0">
          <WeekGrid
            week={week}
            itemsForDay={itemsForDay}
            indexOf={indexOf}
            selectedSpot={selectedSpot}
            onSelect={onSelect}
            onDropOnDay={onDropOnDay}
            onAddOnDay={onAddOnDay}
            tripLength={days}
          />
        </div>
      ))}
    </div>
  );
}

export function CalendarView({
  itinerary,
  startDate,
  days,
  subView,
  selectedSpot,
  onSelect,
  onPickDate,
  pickedDate,
  onMoveItem,
  onAddOnDay,
  actions,
}: Props) {
  const [dayIndex, setDayIndex] = useState(1);
  const [weekIndex, setWeekIndex] = useState(0);
  const [dayDropTarget, setDayDropTarget] = useState<{ item: ItineraryItem; position: DropPosition } | null>(null);

  const isPreBuild = itinerary.length === 0;

  const weeks = buildCalendarWeeks(startDate, days);

  const itemsForDay = (day: number) =>
    itinerary.filter((i) => i.day === day).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  const indexOf = (item: ItineraryItem) => itinerary.indexOf(item);
  const handleDropOnDay = (from: number, day: number) => onMoveItem(from, { kind: 'day', day });

  if (isPreBuild) {
    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto">
        {actions && <div className="flex justify-end">{actions}</div>}
        <PickerMonthGrid anchorDate={startDate} onPick={onPickDate ?? (() => {})} pickedDate={pickedDate} />
      </div>
    );
  }

  const gridProps = {
    itemsForDay,
    indexOf,
    selectedSpot,
    onSelect,
    onDropOnDay: handleDropOnDay,
    onAddOnDay,
    tripLength: days,
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      {actions && <div className="flex justify-end">{actions}</div>}

      {subView === 'day' && (
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
          {days > 1 && (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setDayIndex((d) => Math.max(1, d - 1))}
                disabled={dayIndex <= 1}
                className="disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-700">Day {dayIndex}</span>
              <button
                type="button"
                onClick={() => setDayIndex((d) => Math.min(days, d + 1))}
                disabled={dayIndex >= days}
                className="disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <div
            className="p-5 flex flex-col gap-3 min-h-48 cursor-pointer"
            onClick={(e) => {
              // Only empty space: clicks on an event are handled by the event itself.
              if (e.target === e.currentTarget) onAddOnDay(dayIndex);
            }}
            onDragOver={(e) => {
              if (isItineraryDrag(e)) e.preventDefault();
            }}
            onDrop={(e) => {
              const from = readDraggedIndex(e);
              if (from === null) return;
              e.preventDefault();
              handleDropOnDay(from, dayIndex);
            }}
          >
            {itemsForDay(dayIndex).length === 0 && (
              <p className="text-sm text-gray-300 pointer-events-none">Nothing scheduled — click to add a place.</p>
            )}
            {itemsForDay(dayIndex).map((item) => (
              <button
                key={indexOf(item)}
                type="button"
                draggable
                onDragStart={(e) => startItemDrag(e, indexOf(item))}
                onDragOver={(e) => {
                  if (!isItineraryDrag(e)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const position = dropPosition(e);
                  setDayDropTarget((prev) => (prev?.item === item && prev.position === position ? prev : { item, position }));
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDayDropTarget(null);
                }}
                onDrop={(e) => {
                  const from = readDraggedIndex(e);
                  const position = dropPosition(e);
                  setDayDropTarget(null);
                  if (from === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onMoveItem(from, { kind: 'item', anchor: item, position });
                }}
                onDragEnd={() => setDayDropTarget(null)}
                onClick={() => onSelect(item)}
                style={{
                  backgroundColor: CATEGORY_COLORS[item.category],
                  boxShadow:
                    dayDropTarget?.item === item
                      ? dayDropTarget.position === 'before'
                        ? '0 -3px 0 0 #1b2a41'
                        : '0 3px 0 0 #1b2a41'
                      : undefined,
                }}
                className={`text-left rounded-lg px-3 py-2 text-white ${
                  selectedSpot?.name === item.name ? 'ring-2 ring-offset-1 ring-gray-800' : ''
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-80">{item.slot}</div>
                <div className="text-sm font-semibold">{getSpotEmoji(item)} {item.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {subView === 'week' && (
        days <= 7 ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <WeekGrid week={buildTripDayRow(startDate, Math.max(days, 7))} {...gridProps} showWeekday />
          </div>
        ) : weeks[weekIndex] && (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
                disabled={weekIndex <= 0}
                className="disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-700">Week {weekIndex + 1} of {weeks.length}</span>
              <button
                type="button"
                onClick={() => setWeekIndex((w) => Math.min(weeks.length - 1, w + 1))}
                disabled={weekIndex >= weeks.length - 1}
                className="disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-2 py-1.5 text-xs font-semibold text-gray-500 text-center">
                  {label}
                </div>
              ))}
            </div>
            <WeekGrid week={weeks[weekIndex]} {...gridProps} />
          </div>
        )
      )}

      {subView === 'month' && <TripMonthGrid key={startDate} startDate={startDate} days={days} {...gridProps} />}
    </div>
  );
}
