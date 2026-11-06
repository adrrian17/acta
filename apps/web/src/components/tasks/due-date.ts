import { formatDate } from "../format-date";

/** `now` as YYYY-MM-DD in the browser's time zone; the server never knows it (spec: tasks). */
export function localDay(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** A YYYY-MM-DD day as a local-midnight Date, without shifting it through UTC. */
export function parseDay(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);

  return new Date(year, month - 1, date);
}

/** A YYYY-MM-DD day in the browser's locale. */
export function formatDay(day: string): string {
  return formatDate(parseDay(day).getTime());
}

/** How an Open Task's Due date compares with `today`; YYYY-MM-DD text compares like the dates it holds. */
export function dueStatus(
  dueDate: string,
  today: string
): "overdue" | "today" | "upcoming" {
  if (dueDate < today) {
    return "overdue";
  }

  return dueDate === today ? "today" : "upcoming";
}
