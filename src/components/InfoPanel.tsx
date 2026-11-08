import { ExternalLink, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Suspense, use } from "react";
import type { PolityProps, Snapshot } from "../data/atlas";
import { lang, type MessageKey, t } from "../lib/i18n";
import type { SearchEntry } from "../lib/search";
import { wikiSummary } from "../lib/wikipedia";
import { formatYear } from "../lib/years";
import { YearLabel } from "./YearLabel";

const PRECISION: Record<number, MessageKey | undefined> = {
  1: "precision.1",
  2: "precision.2",
  3: "precision.3",
};

type Props = {
  name: string;
  /** The polity in the snapshot on screen; undefined when it doesn't exist in that period. */
  polity: PolityProps | undefined;
  entry: SearchEntry | undefined;
  snapshots: Snapshot[];
  currentYear: number;
  onClose: () => void;
  onJump: (year: number) => void;
  onSelect: (name: string) => void;
};

export function InfoPanel({ name, polity, entry, snapshots, currentYear, onClose, onJump, onSelect }: Props) {
  const reduceMotion = useReducedMotion();
  const labels = { bce: t("bce"), ce: t("ce") };
  const years = new Set(entry?.years);
  const first = entry?.years[0];
  const last = entry?.years.at(-1);
  const ruler = polity?.subject && polity.subject !== name ? polity.subject : undefined;
  const region =
    polity?.partOf && polity.partOf !== name && polity.partOf !== ruler ? polity.partOf : undefined;
  const precision = PRECISION[polity?.precision ?? 0];

  return (
    <motion.aside
      aria-label={name}
      className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-panel shadow-2xl shadow-black/40 backdrop-blur-xl"
      initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 24, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <header className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          {precision && (
            <p className="font-medium text-[11px] text-gold/80 uppercase tracking-[0.2em]">{t(precision)}</p>
          )}
          <h2 className="mt-1 font-display font-semibold text-2xl text-ink leading-tight">{name}</h2>
        </div>
        <button
          type="button"
          className="icon-button -mr-2 -mt-1"
          onClick={onClose}
          aria-label={t("close")}
          title={t("close")}
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pt-3 pb-5">
        {!polity && (
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-ink/70 text-sm">
            {t("notOnMapIn")} {formatYear(currentYear, lang, labels)}
          </p>
        )}

        {first !== undefined && last !== undefined && (
          <div>
            <p className="text-ink/55 text-xs uppercase tracking-[0.16em]">{t("onTheMap")}</p>
            <p className="mt-1 text-ink text-sm">
              <YearLabel year={first} markerClassName="text-ink/60" />
              {first !== last && (
                <>
                  {" – "}
                  <YearLabel year={last} markerClassName="text-ink/60" />
                </>
              )}
              <span className="text-ink/50">
                {" · "}
                {entry?.years.length} {t("snapshots")}
              </span>
            </p>
          </div>
        )}

        {(ruler || region) && (
          <dl className="space-y-2 text-sm">
            {ruler && (
              <div>
                <dt className="text-ink/55 text-xs uppercase tracking-[0.16em]">{t("subjectOf")}</dt>
                <dd className="mt-0.5">
                  <button
                    type="button"
                    className="text-gold underline-offset-4 hover:underline"
                    onClick={() => onSelect(ruler)}
                  >
                    {ruler}
                  </button>
                </dd>
              </div>
            )}
            {region && (
              <div>
                <dt className="text-ink/55 text-xs uppercase tracking-[0.16em]">{t("partOf")}</dt>
                <dd className="mt-0.5 text-ink">{region}</dd>
              </div>
            )}
          </dl>
        )}

        {entry && (
          <div>
            <p className="text-ink/55 text-xs uppercase tracking-[0.16em]">{t("presence")}</p>
            <div className="mt-2 flex h-6 items-stretch gap-[2px]">
              {snapshots.map((s) => {
                const present = years.has(s.year);
                const isCurrent = s.year === currentYear;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!present}
                    onClick={() => onJump(s.year)}
                    title={formatYear(s.year, lang, labels)}
                    aria-label={formatYear(s.year, lang, labels)}
                    className={`flex-1 rounded-[2px] transition ${
                      present ? "bg-gold/60 hover:bg-gold" : "bg-white/8"
                    } ${isCurrent ? "outline-2 outline-ink outline-offset-1" : ""}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        <Suspense fallback={<WikiSkeleton />}>
          <WikiCard name={name} wiki={polity?.wiki ?? entry?.wiki} />
        </Suspense>
      </div>
    </motion.aside>
  );
}

function WikiCard({ name, wiki }: { name: string; wiki: string | undefined }) {
  const summary = use(wikiSummary(name, wiki, lang));
  if (!summary) return <p className="text-ink/50 text-sm">{t("noSummary")}</p>;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      {summary.thumbnail && (
        <img
          src={summary.thumbnail}
          alt=""
          className="h-40 w-full bg-white/5 object-cover opacity-90"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="p-4">
        <p className="text-[11px] text-ink/50 uppercase tracking-[0.16em]">
          {t("fromWikipedia")} · {summary.title}
        </p>
        <p className="mt-2 line-clamp-[9] text-ink/85 text-sm leading-relaxed" lang={summary.lang}>
          {summary.extract}
        </p>
        <a
          href={summary.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 font-medium text-gold text-sm underline-offset-4 hover:underline"
        >
          {t("readOnWikipedia")}
          <ExternalLink size={14} />
        </a>
      </div>
    </article>
  );
}

function WikiSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4" aria-busy>
      <div className="h-3 w-1/3 rounded bg-white/10" />
      <div className="h-3 w-full rounded bg-white/10" />
      <div className="h-3 w-5/6 rounded bg-white/10" />
      <div className="h-3 w-2/3 rounded bg-white/10" />
    </div>
  );
}
