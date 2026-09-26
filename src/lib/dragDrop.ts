import type { DragEvent } from 'react';
import type { ItineraryItem } from './types';

export const DRAG_MIME = 'application/x-itinerary-index';

export type DropPosition = 'before' | 'after';

// Either drop next to a specific item (adopting its day and slot, and its place in the
// order), drop on a whole day (keeping the dragged item's slot), or move to an exact
// day and slot (used by the tap-to-move buttons on touch screens).
export type MoveTarget =
  | { kind: 'item'; anchor: ItineraryItem; position: DropPosition }
  | { kind: 'day'; day: number }
  | { kind: 'slot'; day: number; slot: ItineraryItem['slot'] };

export function startItemDrag(e: DragEvent, index: number) {
  e.dataTransfer.setData(DRAG_MIME, String(index));
  e.dataTransfer.effectAllowed = 'move';
}

// dataTransfer contents are unreadable during dragover, but the declared types are not,
// so this is how a drop zone knows whether the drag is one of ours.
export function isItineraryDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(DRAG_MIME);
}

export function readDraggedIndex(e: DragEvent): number | null {
  const index = Number(e.dataTransfer.getData(DRAG_MIME));
  return Number.isInteger(index) ? index : null;
}

export function dropPosition(e: DragEvent<HTMLElement>): DropPosition {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

export function moveItem(
  items: ItineraryItem[],
  fromIndex: number,
  target: MoveTarget,
): { items: ItineraryItem[]; moved: ItineraryItem } | null {
  const dragged = items[fromIndex];
  if (!dragged) return null;

  const rest = items.filter((_, i) => i !== fromIndex);

  if (target.kind === 'day') {
    const moved = { ...dragged, day: target.day };
    return { items: [...rest, moved], moved };
  }

  if (target.kind === 'slot') {
    const moved = { ...dragged, day: target.day, slot: target.slot };
    return { items: [...rest, moved], moved };
  }

  if (target.anchor === dragged) return null;
  const anchorIndex = rest.indexOf(target.anchor);
  if (anchorIndex === -1) return null;

  const moved = { ...dragged, day: target.anchor.day, slot: target.anchor.slot };
  rest.splice(target.position === 'after' ? anchorIndex + 1 : anchorIndex, 0, moved);
  return { items: rest, moved };
}
