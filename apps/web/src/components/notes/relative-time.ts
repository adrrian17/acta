const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "21 minutes ago" style text for a past epoch-millisecond timestamp. */
export function relativeTime(timestamp: number, now: number): string {
  const elapsed = Math.max(0, now - timestamp);

  const [unit, size] = UNITS.find(([, ms]) => elapsed >= ms) ?? [
    "second",
    1000,
  ];

  return formatter.format(-Math.floor(elapsed / size), unit);
}
