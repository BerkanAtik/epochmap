import { ChevronsLeft, ChevronsRight, Gauge, Pause, Play } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type CSSProperties, useState } from "react";
import { useLang, useT } from "../lib/i18n";
import { clampYear, ERAS, eraOf } from "../lib/years";

type Props = {
  start: number;
  end: number;
  year: number;
  /** Years with border changes, ascending. */
  changes: readonly number[];
  playing: boolean;
  /** Playback speed in years per second. */
  speed: number;
  onYear: (year: number) => void;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
  onPreviousChange: () => void;
  onNextChange: () => void;
};

/** Thumb radius in px; positions are inset by it so they line up with the thumb's centre. */
const THUMB_R = 9;
const BUCKET_YEARS = 25;
const TICKS = [0, 500, 1000, 1500, 2000];

const ERA_TINT: Record<string, string> = {
  "era.ancient": "bg-amber-300/30",
  "era.medieval": "bg-rose-300/30",
  "era.earlyModern": "bg-sky-300/30",
  "era.modern": "bg-emerald-300/30",
  "era.contemporary": "bg-violet-300/30",
};

export function Timeline(props: Props) {
  const { start, end, year, changes, playing, speed } = props;
  const t = useT();
  const lang = useLang();
  const reduceMotion = useReducedMotion();
  const span = end - start;
  const fraction = (y: number) => (y - start) / span;
  const at = (y: number) => `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${fraction(y)})`;

  // How many borders change in each 25-year bucket: a quiet sparkline of history's busy times.
  const buckets = new Array<number>(Math.ceil((span + 1) / BUCKET_YEARS)).fill(0);
  for (const y of changes) {
    const i = Math.floor((y - start) / BUCKET_YEARS);
    buckets[i] = (buckets[i] ?? 0) + 1;
  }
  const busiest = Math.max(1, ...buckets);

  const eras = ERAS[lang]
    .map((era, i, all) => ({
      key: era.key,
      from: Math.max(start, era.from),
      to: Math.min(end, (all[i + 1]?.from ?? end + 1) - 1),
    }))
    .filter((e) => e.from <= e.to);

  return (
    <section
      aria-label={t("timeline")}
      className="pointer-events-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-panel p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-6 sm:pt-5 sm:pb-4"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[11px] text-gold/80 uppercase tracking-[0.22em]">
            {t(eraOf(year, lang))}
          </p>
          <YearInput
            year={year}
            start={start}
            end={end}
            onYear={props.onYear}
            label={t("editYear")}
            animate={!reduceMotion && !playing}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            className="icon-button"
            onClick={props.onPreviousChange}
            disabled={year <= (changes[0] ?? start)}
            aria-label={t("previousChange")}
            title={`${t("previousChange")} (PgUp)`}
          >
            <ChevronsLeft size={20} />
          </button>
          <button
            type="button"
            className="grid size-12 place-items-center rounded-full bg-gold text-space shadow-gold/20 shadow-lg transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 active:scale-95"
            onClick={props.onTogglePlay}
            aria-label={playing ? t("pause") : t("play")}
            title={`${playing ? t("pause") : t("play")} (Space)`}
          >
            {playing ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={props.onNextChange}
            disabled={year >= (changes.at(-1) ?? end)}
            aria-label={t("nextChange")}
            title={`${t("nextChange")} (PgDn)`}
          >
            <ChevronsRight size={20} />
          </button>
          <button
            type="button"
            onClick={props.onCycleSpeed}
            className="ml-1 hidden h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-ink/70 text-xs tabular-nums transition hover:bg-white/5 hover:text-ink sm:flex"
            aria-label={`${t("speed")}: ${speed} ${t("yearsPerSecond")}`}
            title={t("speed")}
          >
            <Gauge size={14} />
            {speed} {t("yearsPerSecond")}
          </button>
        </div>
      </div>

      {/* Border-change density */}
      <div
        aria-hidden
        className="mt-3 flex h-6 items-end gap-px"
        style={{ marginInline: THUMB_R }}
        title={t("bordersChanging")}
      >
        {buckets.map((count, i) => {
          const bucketStart = start + i * BUCKET_YEARS;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: buckets are fixed positions on the axis
              key={i}
              className={`flex-1 rounded-t-[1px] ${bucketStart <= year ? "bg-gold/55" : "bg-white/15"}`}
              style={{ height: count ? `${Math.max(12, Math.sqrt(count / busiest) * 100)}%` : "2px" }}
            />
          );
        })}
      </div>

      <input
        type="range"
        className="timeline-range relative -mt-1 w-full"
        min={start}
        max={end}
        step={1}
        value={year}
        onChange={(e) => props.onYear(Number(e.target.value))}
        aria-label={t("timeline")}
        style={{ "--progress": at(year) } as CSSProperties}
      />

      {/* Eras and century marks */}
      <div aria-hidden className="relative mt-1 h-5 text-[11px]">
        {eras.map((era, i) => {
          const isCurrent = eraOf(year, lang) === era.key;
          // Recent eras are short on a 2,000-year axis: name them only while they are on screen.
          const narrow = (era.to - era.from + 1) / span < 0.1;
          const last = i === eras.length - 1;
          return (
            <div
              key={era.key}
              className={`absolute top-0 flex h-full items-center px-1 ${last ? "justify-end" : "justify-center"}`}
              style={{
                left: at(era.from),
                width: `calc((100% - ${THUMB_R * 2}px) * ${(era.to - era.from + 1) / span})`,
              }}
            >
              <div
                className={`absolute inset-x-px top-0 h-0.5 rounded-full ${ERA_TINT[era.key] ?? "bg-white/20"}`}
              />
              {(!narrow || isCurrent) && (
                <span
                  className={`hidden whitespace-nowrap transition-colors sm:block ${isCurrent ? "text-ink/85" : "text-ink/35"}`}
                >
                  {t(era.key)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div aria-hidden className="relative mt-0.5 h-4 text-[10px] text-ink/40 tabular-nums">
        {TICKS.filter((y) => y >= start && y <= end).map((y) => (
          <span key={y} className="-translate-x-1/2 absolute" style={{ left: at(y) }}>
            {y}
          </span>
        ))}
      </div>
    </section>
  );
}

/** The big year, which turns into a text field when clicked so any year can be typed in. */
function YearInput(props: {
  year: number;
  start: number;
  end: number;
  label: string;
  animate: boolean;
  onYear: (year: number) => void;
}) {
  const { year, start, end, label, animate, onYear } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const big = "font-display font-semibold text-4xl text-ink tabular-nums leading-none sm:text-5xl";

  if (editing) {
    const commit = () => {
      const value = Number.parseInt(draft, 10);
      if (Number.isFinite(value)) onYear(clampYear(value, start, end));
      setEditing(false);
    };
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: the field appears because the user asked to type a year
        autoFocus
        inputMode="numeric"
        aria-label={label}
        className={`${big} mt-1 h-10 w-36 rounded-lg bg-white/5 px-2 outline-none ring-1 ring-gold/60 sm:h-12`}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
          e.stopPropagation();
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="group relative mt-1 block h-10 overflow-hidden rounded-lg text-left sm:h-12"
      onClick={() => {
        setDraft(String(year));
        setEditing(true);
      }}
      title={label}
      aria-label={`${year}. ${label}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={animate ? year : "static"}
          className={`${big} block group-hover:text-gold`}
          initial={animate ? { y: 24, opacity: 0, filter: "blur(5px)" } : false}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={animate ? { y: -24, opacity: 0, filter: "blur(5px)" } : undefined}
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
        >
          {year}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
