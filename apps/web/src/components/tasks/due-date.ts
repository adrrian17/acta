/** `now` as YYYY-MM-DD in the browser's time zone; the server never knows it (spec: tasks). */
export function localDay(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** A YYYY-MM-DD day in the browser's locale, without shifting it through UTC. */
export function formatDay(day: string): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);

  return new Date(year, month - 1, date).toLocaleDateString();
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
