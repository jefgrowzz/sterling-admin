// Today in UTC, as YYYY-MM-DD — matches the app's live lookup, which defaults to
// (now() AT TIME ZONE 'utc')::date. This is what's actually showing on a phone
// right now, so it's the default date this page opens to.
export function getTodayUtcDate(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}

// Tomorrow in UTC — for prepping the next day's override ahead of time. Not the
// default view, since it's not what the app is currently serving.
export function getTomorrowUtcDate(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.toISOString().slice(0, 10);
}
