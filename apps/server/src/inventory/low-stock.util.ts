export function crossedLowStockThreshold(
  previousStock: number,
  nextStock: number,
  threshold: number,
): boolean {
  return previousStock > threshold && nextStock <= threshold;
}
