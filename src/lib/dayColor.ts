// One color per trip day, shared by the map pins, routes, list badges, and table.
const DAY_COLORS = ['#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#65a30d'];

export function dayColor(day: number): string {
  return DAY_COLORS[(day - 1) % DAY_COLORS.length];
}
