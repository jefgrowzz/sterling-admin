// Tomorrow in UTC, as YYYY-MM-DD — matches what the mobile app requests via
// p_date_utc (the override is prepared a day ahead of when it goes live).
export function getTomorrowUtcDate(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.toISOString().slice(0, 10);
}
