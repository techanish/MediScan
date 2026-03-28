export function toBlockchainDate(rawTimestamp: unknown): Date {
  if (typeof rawTimestamp === 'string' && rawTimestamp.trim() !== '') {
    const directParse = Date.parse(rawTimestamp);
    if (Number.isFinite(directParse)) {
      return new Date(directParse);
    }
  }

  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp)) {
    return new Date(0);
  }

  const absValue = Math.abs(timestamp);

  // Seconds (10 digits) from Python time.time().
  if (absValue >= 1e9 && absValue < 1e12) {
    return new Date(timestamp * 1000);
  }

  // Milliseconds (13 digits) from Date.now().
  if (absValue >= 1e12 && absValue < 1e15) {
    return new Date(timestamp);
  }

  // Microseconds (16 digits) fallback if legacy values were over-multiplied.
  if (absValue >= 1e15) {
    return new Date(timestamp / 1000);
  }

  return new Date(timestamp);
}

export function formatDateTimeDayFirst(value: Date | number | string): string {
  const input = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(input.getTime())) {
    return typeof value === 'string' ? value : 'N/A';
  }

  return input
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .replace(' am', ' AM')
    .replace(' pm', ' PM');
}
