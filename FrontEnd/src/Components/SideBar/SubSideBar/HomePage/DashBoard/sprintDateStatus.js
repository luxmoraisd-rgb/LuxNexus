function toDateKey(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(value, defaultYear) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (isoDate) {
    return toDateKey(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
  }

  const dateText = /\b\d{4}\b/.test(text) ? text : `${text}, ${defaultYear}`;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getSprintDateRange(sprint, today) {
  const dates = String(sprint.dates || sprint.duration_text || sprint.durationText || "")
    .replace(/\s*\([^)]*\)\s*$/, "");
  const range = dates.split(/\s+-\s+|[–—]|\s+to\s+/i);
  const startValue = sprint.startDate || sprint.start_date || range[0];
  const endValue = sprint.endDate || sprint.end_date || range[1];
  const year = `${startValue || ""} ${endValue || ""}`.match(/\b\d{4}\b/)?.[0]
    || today.slice(0, 4);

  return {
    startDate: parseDateKey(startValue, year),
    endDate: parseDateKey(endValue, year),
  };
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isSprintUpcoming(sprint, today = getLocalDateKey()) {
  const { startDate } = getSprintDateRange(sprint, today);
  return Boolean(startDate && startDate > today);
}
