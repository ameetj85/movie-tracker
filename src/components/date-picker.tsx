"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Earliest year offered in the year dropdown (a stored earlier date still shows). */
const MIN_YEAR = 1950;

const MONTHS = Array.from({ length: 12 }, (_, m) =>
  new Date(Date.UTC(2000, m, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }),
);
const MONTH_ITEMS: Record<string, string> = Object.fromEntries(MONTHS.map((name, m) => [String(m), name]));
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Ymd = { year: number; month: number; day: number }; // month is 0-based

function parse(value: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) } : null;
}

function toIso({ year, month, day }: Ymd): string {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Same day in another month/year, clamped (Feb 29 → Feb 28, Mar 31 → Apr 30). */
function moveTo(date: Ymd, year: number, month: number): Ymd {
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

type DatePickerProps = {
  id?: string;
  /** `YYYY-MM-DD`, or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
};

/**
 * Calendar popover with month and year dropdowns, so jumping years doesn't
 * mean paging through months. Picking a month or year while a date is set
 * moves that date (keeping the day, clamped to the month's length).
 */
export function DatePicker({ id, value, onChange, placeholder = "Pick a date", ...props }: DatePickerProps) {
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  // "Today" is read when the popover opens, never during render (see CLAUDE.md).
  const [today, setToday] = useState<Ymd | null>(null);
  const [view, setView] = useState<{ year: number; month: number }>({ year: 2000, month: 0 });

  function handleOpenChange(next: boolean) {
    if (next) {
      const now = new Date();
      const t = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
      setToday(t);
      setView(selected ? { year: selected.year, month: selected.month } : { year: t.year, month: t.month });
    }
    setOpen(next);
  }

  /** Month/year dropdowns: change the view, and move the selected date along with it. */
  function jump(year: number, month: number) {
    setView({ year, month });
    if (selected) onChange(toIso(moveTo(selected, year, month)));
  }

  /** Arrow buttons: browse months without changing the selected date. */
  function step(delta: number) {
    const d = new Date(Date.UTC(view.year, view.month + delta, 1));
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }

  function pick(ymd: Ymd) {
    onChange(toIso(ymd));
    setOpen(false);
  }

  const maxYear = Math.max((today?.year ?? view.year) + 1, view.year);
  const minYear = Math.min(MIN_YEAR, view.year);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));
  const yearItems = Object.fromEntries(years.map((y) => [y, y]));

  const leading = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const total = daysInMonth(view.year, view.month);
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  const sameDay = (a: Ymd | null, day: number) =>
    a != null && a.year === view.year && a.month === view.month && a.day === day;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        id={id}
        aria-invalid={props["aria-invalid"]}
        className={cn(
          "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-card px-2.5 text-left text-base shadow-xs transition-[color,border-color,box-shadow] outline-none hover:border-primary/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-popup-open:border-primary md:text-sm dark:bg-input/30",
          !selected && "text-muted-foreground",
        )}
      >
        <CalendarIcon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{selected ? formatDate(value) : placeholder}</span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 gap-3 rounded-xl p-3 shadow-xl shadow-primary/20 ring-primary/15">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => step(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Select
            items={MONTH_ITEMS}
            value={String(view.month)}
            onValueChange={(v) => v != null && jump(view.year, Number(v))}
          >
            <SelectTrigger size="sm" aria-label="Month" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, m) => (
                <SelectItem key={m} value={String(m)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={yearItems}
            value={String(view.year)}
            onValueChange={(v) => v != null && jump(Number(v), view.month)}
          >
            <SelectTrigger size="sm" aria-label="Year" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => step(1)}>
            <ChevronRightIcon />
          </Button>
        </div>

        <div role="group" aria-label={`${MONTHS[view.month]} ${view.year}`} className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w) => (
            <span key={w} aria-hidden className="py-1 text-center text-xs font-medium text-muted-foreground">
              {w}
            </span>
          ))}
          {cells.map((day, i) =>
            day == null ? (
              <span key={`blank-${i}`} aria-hidden />
            ) : (
              <button
                key={day}
                type="button"
                aria-pressed={sameDay(selected, day)}
                aria-label={formatDate(toIso({ year: view.year, month: view.month, day })) ?? undefined}
                onClick={() => pick({ year: view.year, month: view.month, day })}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition-all outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  sameDay(today, day) && "font-semibold text-primary ring-1 ring-primary/40",
                  sameDay(selected, day) &&
                    "bg-primary text-primary-foreground shadow-md shadow-primary/40 ring-0 hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {day}
              </button>
            ),
          )}
        </div>

        <div className="flex items-center justify-between border-t border-primary/10 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => today && pick(today)}>
            Today
          </Button>
          {selected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
