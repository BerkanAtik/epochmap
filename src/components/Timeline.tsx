import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import type { Snapshot } from "../data/atlas";
import { lang, t } from "../lib/i18n";
import { ERAS, eraOf, formatYear } from "../lib/years";
import { YearLabel } from "./YearLabel";

type Props = {
  snapshots: Snapshot[];
  index: number;
  playing: boolean;
  onChange: (index: number) => void;
  onTogglePlay: () => void;
};

/** Thumb radius in px; tick positions are inset by it so they line up with the thumb's centre. */
const THUMB_R = 9;

/** Horizontal position of snapshot `i` along the track, as a CSS length. */
function at(i: number, count: number): string {
  const f = count > 1 ? i / (count - 1) : 0;
  return `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${f})`;
}

const ERA_TINT: Record<string, string> = {
  prehistory: "bg-stone-400/25",
  ancient: "bg-amber-300/25",
  medieval: "bg-rose-300/25",
  earlyModern: "bg-sky-300/25",
  modern: "bg-emerald-300/25",
};

export function Timeline({ snapshots, index, playing, onChange, onTogglePlay }: Props) {
  const reduceMotion = useReducedMotion();
  const current = snapshots[index];
  if (!current) return null;
  const count = snapshots.length;
  const labels = { bce: t("bce"), ce: t("ce") };

  // Each era covers a run of consecutive snapshots.
  const bands = ERAS.map((era) => {
    const members = snapshots.flatMap((s, i) => (eraOf(s.year) === era.id ? [i] : []));
    return { id: era.id, first: members[0], last: members.at(-1) };
  }).filter(
    (b): b is { id: (typeof ERAS)[number]["id"]; first: number; last: number } => b.first !== undefined,
  );

  return (
    <section
      aria-label={t("timeline")}
      className="pointer-events-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-panel p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-6 sm:pt-5 sm:pb-4"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-[11px] text-gold/80 uppercase tracking-[0.22em]">
            {t(`era.${eraOf(current.year)}`)}
          </p>
          <div className="relative mt-1 h-10 overflow-hidden sm:h-12" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={current.year}
                className="font-display font-semibold text-4xl text-ink tabular-nums leading-none sm:text-5xl"
                initial={reduceMotion ? false : { y: 28, opacity: 0, filter: "blur(6px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={reduceMotion ? undefined : { y: -28, opacity: 0, filter: "blur(6px)" }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              >
                <YearLabel
                  year={current.year}
                  markerClassName="font-sans font-medium text-base text-ink/60 sm:text-lg"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label={t("previous")}
            title={t("previous")}
          >
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            className="grid size-12 place-items-center rounded-full bg-gold text-space shadow-gold/20 shadow-lg transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 active:scale-95"
            onClick={onTogglePlay}
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
            onClick={() => onChange(Math.min(count - 1, index + 1))}
            disabled={index === count - 1}
            aria-label={t("next")}
            title={t("next")}
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      <div className="relative mt-4 select-none">
        {/* Snapshot ticks */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0">
          {snapshots.map((s, i) => (
            <span
              key={s.id}
              className={`-translate-x-1/2 -translate-y-1/2 absolute h-2.5 w-px ${i <= index ? "bg-gold/70" : "bg-white/20"}`}
              style={{ left: at(i, count) }}
            />
          ))}
        </div>
        <input
          type="range"
          className="timeline-range relative w-full"
          min={0}
          max={count - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t("timeline")}
          aria-valuetext={formatYear(current.year, lang, labels)}
          style={{ "--progress": at(index, count) } as CSSProperties}
        />
      </div>

      {/* Era bands */}
      <div aria-hidden className="relative mt-2 h-5">
        {bands.map((band) => {
          const half = count > 1 ? 0.5 / (count - 1) : 0;
          const from = Math.max(0, band.first / (count - 1) - half);
          const to = Math.min(1, band.last / (count - 1) + half);
          const isCurrent = eraOf(current.year) === band.id;
          return (
            <div
              key={band.id}
              className="absolute top-0 flex h-full items-center justify-center px-1"
              style={{
                left: `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${from})`,
                width: `calc((100% - ${THUMB_R * 2}px) * ${to - from})`,
              }}
            >
              <div className={`absolute inset-x-px top-0 h-0.5 rounded-full ${ERA_TINT[band.id]}`} />
              <span
                // Labels may spill a little past narrow bands (prehistory); neighbours are centred, so they don't collide.
                className={`hidden whitespace-nowrap text-[11px] transition-colors sm:block ${
                  isCurrent ? "text-ink/80" : "text-ink/35"
                }`}
              >
                {t(`era.${band.id}`)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
