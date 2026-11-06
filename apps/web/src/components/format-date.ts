/** An epoch-millisecond timestamp as a medium date in the browser's locale. */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}
