/** D1 rejects statements with more bound parameters than this. */
export const D1_MAX_PARAMS = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
