import { ExternalLink, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, type Ref, Suspense, use } from "react";
import type { DisputeProps, Polity } from "../data/atlas";
import { type Lang, useLang, useT } from "../lib/i18n";
import { wikiSummary } from "../lib/wikipedia";
import { formatSpans } from "../lib/years";

type Common = {
  year: number;
  start: number;
  end: number;
  onClose: () => void;
  /** Lets AnimatePresence measure the panel. */
  ref?: Ref<HTMLElement>;
};

type PolityPanelProps = Common & {
  polity: Polity;
  /** Name for the year on screen, when the polity is on the map then. */
  currentName: string | undefined;
  /** Empire it belongs to in the year on screen. */
  partOf: { id: string; name: string } | undefined;
  onJump: (year: number) => void;
  onSelect: (id: string) => void;
};

function Panel(props: {
  label: string;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  return (
    <motion.aside
      ref={props.ref}
      aria-label={props.label}
      className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-panel shadow-2xl shadow-black/40 backdrop-blur-xl"
      initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 24, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <header className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          {props.eyebrow && (
            <p className="font-medium text-[11px] text-gold/80 uppercase tracking-[0.2em]">{props.eyebrow}</p>
          )}
          <h2 className="mt-1 font-display font-semibold text-2xl text-ink leading-tight">{props.title}</h2>
        </div>
        <button
          type="button"
          className="icon-button -mt-1 -mr-2"
          onClick={props.onClose}
          aria-label={t("close")}
          title={t("close")}
        >
          <X size={18} />
        </button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 pt-3 pb-5">{props.children}</div>
    </motion.aside>
  );
}

const latestName = (polity: Polity, lang: Lang) => polity[lang].at(-1) ?? polity.en.at(-1) ?? polity.id;

export function PolityPanel(props: PolityPanelProps) {
  const { polity, currentName, partOf, year, start, end, onClose, onJump, onSelect, ref } = props;
  const t = useT();
  const lang = useLang();
  const title = currentName ?? latestName(polity, lang);
  const otherNames = polity[lang].filter((n) => n !== title);
  const total = end - start + 1;

  return (
    <Panel
      ref={ref}
      label={title}
      title={title}
      onClose={onClose}
      eyebrow={partOf ? `${t("partOf")}: ${partOf.name}` : undefined}
    >
      {!currentName && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-ink/70 text-sm">
          {t("notOnMapIn")} {year}
        </p>
      )}

      <div>
        <p className="text-ink/55 text-xs uppercase tracking-[0.16em]">{t("onTheMap")}</p>
        <p className="mt-1 text-ink text-sm tabular-nums">{formatSpans(polity.spans, end, String(end))}</p>
        {/* Presence across the whole timeline; each span jumps to its first year. */}
        <fieldset className="relative mt-2 h-3 rounded-full bg-white/8" aria-label={t("presence")}>
          {polity.spans.map(([f, to]) => (
            <button
              key={f}
              type="button"
              onClick={() => onJump(f)}
              title={`${f}–${to}`}
              aria-label={`${f}–${to}`}
              className="absolute inset-y-0 min-w-[3px] rounded-full bg-gold/70 transition hover:bg-gold"
              style={{ left: `${((f - start) / total) * 100}%`, width: `${((to - f + 1) / total) * 100}%` }}
            />
          ))}
          <span
            aria-hidden
            className="-translate-x-1/2 -top-1 -bottom-1 pointer-events-none absolute w-0.5 rounded-full bg-ink"
            style={{ left: `${((year - start) / total) * 100}%` }}
          />
        </fieldset>
      </div>

      {partOf && (
        <div>
          <p className="text-ink/55 text-xs uppercase tracking-[0.16em]">{t("partOf")}</p>
          <button
            type="button"
            className="mt-0.5 text-gold text-sm underline-offset-4 hover:underline"
            onClick={() => onSelect(partOf.id)}
          >
            {partOf.name}
          </button>
        </div>
      )}

      {otherNames.length > 0 && (
        <div>
          <p className="text-ink/55 text-xs uppercase tracking-[0.16em]">{t("alsoKnownAs")}</p>
          <p className="mt-0.5 text-ink/80 text-sm">{otherNames.join(" · ")}</p>
        </div>
      )}

      <Suspense fallback={<WikiSkeleton />}>
        <WikiCard id={polity.id} titles={polity.wiki} name={polity.en.at(-1) ?? title} lang={lang} />
      </Suspense>
    </Panel>
  );
}

export function DisputePanel({
  dispute,
  onClose,
  ref,
}: Omit<Common, "year" | "start" | "end"> & { dispute: DisputeProps }) {
  const t = useT();
  const lang = useLang();
  const title = lang === "tr" ? dispute.tr : dispute.en;
  return (
    <Panel ref={ref} label={title} title={title} onClose={onClose} eyebrow={t("disputed")}>
      <p className="text-ink/85 text-sm leading-relaxed">
        {lang === "tr" ? dispute.note_tr : dispute.note_en}
      </p>
    </Panel>
  );
}

function WikiCard(props: { id: string; titles: Polity["wiki"]; name: string; lang: Lang }) {
  const t = useT();
  const summary = use(wikiSummary(props.id, props.titles, props.name, props.lang));
  if (!summary) return <p className="text-ink/50 text-sm">{t("noSummary")}</p>;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      {summary.thumbnail && (
        <img
          src={summary.thumbnail}
          alt=""
          className="h-28 w-full bg-white/5 object-cover opacity-90 lg:h-40"
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
