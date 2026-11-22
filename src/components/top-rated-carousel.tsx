"use client";

import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { FormatBadges, Rating } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import { Button } from "@/components/ui/button";
import type { MovieWithCopies } from "@/db/schema";
import { cn } from "@/lib/utils";

/** Medal colors for the top three ranks; the rest share the theme gradient. */
const RANK_STYLES = [
  "from-amber-300 to-yellow-500 text-amber-950",
  "from-slate-200 to-slate-400 text-slate-900",
  "from-orange-300 to-amber-700 text-orange-950",
];

/** Auto-scroll speed in pixels per second. */
const SPEED = 40;
/** How quickly arrow/focus glides settle (higher = snappier). */
const GLIDE = 7;
/** Pointer movement (px) before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 5;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Wrap x into [0, period). */
const wrap = (x: number, period: number) => ((x % period) + period) % period;

/**
 * Top-rated movies as an endless, smoothly gliding marquee.
 *
 * The cards are rendered twice in a row; a requestAnimationFrame loop moves the
 * track left with a sub-pixel `translate3d` and wraps the offset by one set's
 * width, so the second copy seamlessly takes over from the first (no rewind).
 * The copy is aria-hidden and inert, so screen readers and Tab only see one list.
 *
 * Pauses while hovered, while a card has keyboard focus, and in background
 * tabs (rAF stops). Off by default for people who prefer reduced motion.
 * Arrow buttons glide by one card; mouse/touch drag and horizontal trackpad
 * swipes move it by hand. If every card fits on screen it's just a static row.
 */
export function TopRatedCarousel({ movies }: { movies: MovieWithCopies[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);

  // Animation state lives in refs: it changes every frame and must not re-render.
  const offset = useRef(0); // current scroll position (px)
  const pending = useRef(0); // distance still to glide (arrows / focus)
  const period = useRef(0); // width of one set of cards incl. trailing gap
  const running = useRef(false);
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  /** True when the cards overflow the viewport, i.e. there's something to scroll. */
  const [loop, setLoop] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** The pause/play button's choice; null = default (play unless reduced motion). */
  const [userPlay, setUserPlay] = useState<boolean | null>(null);
  // Server snapshot says "reduced", so nothing moves before hydration.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );

  const playing = (userPlay ?? !reducedMotion) && loop;
  const isRunning = playing && !hovered && !focused;
  useEffect(() => {
    running.current = isRunning;
  }, [isRunning]);

  // Measure: does one set overflow the viewport, and how wide is it?
  useEffect(() => {
    const vp = viewport.current;
    const tr = track.current;
    if (!vp || !tr) return;
    const measure = () => {
      const items = tr.children as HTMLCollectionOf<HTMLElement>;
      const first = items[0];
      const last = items[movies.length - 1];
      if (!first || !last) return;
      const setWidth = last.offsetLeft + last.offsetWidth - first.offsetLeft;
      const gap = parseFloat(getComputedStyle(tr).columnGap) || 0;
      period.current = setWidth + gap;
      setLoop(setWidth > vp.clientWidth);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(tr);
    return () => ro.disconnect();
  }, [movies.length]);

  // The frame loop: auto-scroll, glides and wrapping all happen here.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let applied = NaN;
    const frame = (now: number) => {
      // Clamp dt so a long frame (or a tab returning from background) doesn't jump.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let x = offset.current;
      if (pending.current !== 0) {
        const step = Math.abs(pending.current) < 0.5 ? pending.current : pending.current * Math.min(1, dt * GLIDE);
        x += step;
        pending.current -= step;
      } else if (running.current && !drag.current?.moved) {
        x += SPEED * dt;
      }
      x = period.current > 0 && track.current && track.current.children.length > movies.length
        ? wrap(x, period.current)
        : 0;
      offset.current = x;
      if (x !== applied && track.current) {
        track.current.style.transform = `translate3d(${-x}px, 0, 0)`;
        applied = x;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [movies.length]);

  /** Distance between two neighbouring cards (card width + gap). */
  function cardStep() {
    const items = track.current?.children as HTMLCollectionOf<HTMLElement> | undefined;
    return items && items[1] && items[0] ? items[1].offsetLeft - items[0].offsetLeft : 192;
  }

  function nudge(direction: 1 | -1) {
    pending.current += direction * cardStep();
  }

  /** Keyboard focus on a card: glide it to the middle so it's fully visible. */
  function revealCard(card: HTMLElement) {
    const vp = viewport.current;
    if (!vp || !loop || period.current <= 0) return;
    const target = card.offsetLeft - (vp.clientWidth - card.offsetWidth) / 2;
    // Shortest way round the loop.
    let delta = wrap(target - offset.current - pending.current, period.current);
    if (delta > period.current / 2) delta -= period.current;
    pending.current += delta;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!loop || e.button !== 0) return;
    justDragged.current = false;
    pending.current = 0;
    drag.current = { x: e.clientX, start: offset.current, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      viewport.current?.setPointerCapture(e.pointerId);
    }
    if (d.moved) offset.current = d.start - dx;
  }
  function onPointerUp() {
    justDragged.current = !!drag.current?.moved;
    drag.current = null;
  }

  const cards = (copy: boolean) =>
    movies.map((m, i) => (
      <li
        key={`${copy ? "copy" : "main"}-${m.id}`}
        className="w-36 shrink-0 sm:w-40 lg:w-44"
        // The seamless-loop copy is invisible to assistive tech and skipped by Tab.
        aria-hidden={copy || undefined}
        inert={copy || undefined}
      >
        <Link
          href={`/movies/${m.id}`}
          draggable={false}
          onFocus={copy ? undefined : (e) => e.currentTarget.matches(":focus-visible") && revealCard(e.currentTarget.parentElement!)}
          className="group flex h-full flex-col gap-2 rounded-2xl bg-card p-2 shadow-sm ring-1 shadow-primary/10 ring-primary/10 transition-[translate,box-shadow,--tw-ring-color] duration-300 outline-none select-none hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/25 hover:ring-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="relative">
            <Poster
              src={m.posterUrl}
              title={m.title}
              className="rounded-xl [&_img]:pointer-events-none [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-105"
            />
            <span
              className={cn(
                "absolute top-1.5 left-1.5 flex size-8 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold shadow-lg ring-2 ring-white/70 tabular-nums dark:ring-black/40",
                RANK_STYLES[i] ?? "from-violet-500 to-fuchsia-500 text-white",
              )}
              aria-hidden
            >
              {i + 1}
            </span>
          </div>
          <div className="flex flex-col gap-1 px-1 pb-1">
            <h3 className="line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary" title={m.title}>
              <span className="sr-only">Number {i + 1}: </span>
              {m.title}
            </h3>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{m.releaseYear ?? "—"}</span>
              <Rating value={m.rating} className="text-xs" />
            </div>
            <FormatBadges formats={m.copies.map((c) => c.format)} short />
          </div>
        </Link>
      </li>
    ));

  return (
    <section
      aria-labelledby="top-rated-heading"
      className="flex flex-col gap-3"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      // Pause for keyboard focus only: a mouse click on a button (e.g. Play)
      // also focuses it, and must not count as "pause".
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="top-rated-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-amber-300 to-amber-500 text-amber-950 shadow-md shadow-amber-500/30">
            <TrophyIcon className="size-4" aria-hidden />
          </span>
          Top {movies.length} rated
        </h2>
        {loop && (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={playing ? "Pause auto-scroll" : "Start auto-scroll"}
              title={playing ? "Pause auto-scroll" : "Start auto-scroll"}
              onClick={() => setUserPlay(!playing)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Scroll left" onClick={() => nudge(-1)}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Scroll right" onClick={() => nudge(1)}>
              <ChevronRightIcon />
            </Button>
          </div>
        )}
      </div>

      <div
        ref={viewport}
        className={cn(
          // overflow-clip (not hidden): the browser can't scroll it on focus,
          // so the transform is the only thing that moves the cards.
          "relative -mx-1 overflow-clip px-1 pt-1 pb-4 [overflow-clip-margin:0]",
          loop && "cursor-grab touch-pan-y active:cursor-grabbing",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // The click that ends a drag must not open the card under the pointer.
          if (justDragged.current) {
            e.preventDefault();
            e.stopPropagation();
            justDragged.current = false;
          }
        }}
        onWheel={(e) => {
          if (loop && Math.abs(e.deltaX) > Math.abs(e.deltaY)) offset.current += e.deltaX;
        }}
      >
        <ul
          ref={track}
          // `relative` makes this the containing block for the cards' sr-only
          // (absolutely positioned) text, so it's clipped instead of widening the page.
          className="relative flex w-max gap-4 will-change-transform"
        >
          {cards(false)}
          {loop && cards(true)}
        </ul>
        {loop && (
          <>
            {/* Edge fades: cards drift in and out rather than being cut off. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-background to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-background to-transparent"
            />
          </>
        )}
      </div>
    </section>
  );
}
