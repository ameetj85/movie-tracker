export const WATCH_STATUSES = ["unwatched", "in_progress", "watched"] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  unwatched: "Unwatched",
  in_progress: "In Progress",
  watched: "Watched",
};

export const FORMATS = [
  "4K UHD",
  "Blu-ray",
  "DVD",
  "VHS",
  "Digital - Apple TV",
  "Digital - Vudu/Fandango",
  "Digital - Amazon Prime",
  "Digital - Other",
  "Local File",
] as const;

/** Suggestions only — edition is free text. */
export const EDITION_SUGGESTIONS = [
  "Standard",
  "Steelbook",
  "Criterion Collection",
  "Director's Cut",
  "Extended Edition",
  "Collector's Edition",
  "Slipcover",
] as const;

/** Currency used when displaying purchase prices. */
export const CURRENCY = "USD";

export const CONDITIONS = ["New / Sealed", "Like New", "Good", "Fair", "Poor"] as const;
