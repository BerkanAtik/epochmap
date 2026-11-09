import type { FeatureCollection, Point } from "geojson";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useEffectEvent, useState } from "react";
import { AboutDialog } from "./components/AboutDialog";
import { type FocusRequest, GlobeMap, type Selection } from "./components/GlobeMap";
import { DisputePanel, PolityPanel } from "./components/InfoPanel";
import { SearchPalette } from "./components/SearchPalette";
import { Timeline } from "./components/Timeline";
import { TopBar } from "./components/TopBar";
import {
  type AtlasIndex,
  type Disputes,
  loadDisputes,
  loadIndex,
  loadPolities,
  loadWaterLabels,
  loadWindow,
  type Polity,
  type PolityIndex,
  prefetchAround,
  type WaterLabelProps,
  type WindowData,
  windowFor,
} from "./data/atlas";
import { useLang, useT } from "./lib/i18n";
import { clampYear, nextIn, previousIn } from "./lib/years";

/** Opening year: the Mongol Empire near its largest makes a striking first view. */
const DEFAULT_YEAR = 1279;
/** Playback speeds in years per second. */
const SPEEDS = [10, 25, 50];

function readUrl() {
  const params = new URLSearchParams(location.search);
  const year = Number.parseInt(params.get("year") ?? "", 10);
  const polity = params.get("p");
  const dispute = params.get("d");
  const selection: Selection | null = polity
    ? { kind: "polity", id: polity }
    : dispute
      ? { kind: "dispute", id: dispute }
      : null;
  return { year: Number.isFinite(year) ? year : DEFAULT_YEAR, selection };
}

/** The page URL for a view: ?year=…&lang=…&p=… plus the map's own #zoom/lat/lng. */
function urlFor(year: number, lang: string, selected: Selection | null): string {
  const url = new URL(location.href);
  url.searchParams.set("year", String(year));
  url.searchParams.set("lang", lang);
  url.searchParams.delete("p");
  url.searchParams.delete("d");
  if (selected) url.searchParams.set(selected.kind === "polity" ? "p" : "d", selected.id);
  return url.href;
}

const initial = readUrl();

export function App() {
  const t = useT();
  const lang = useLang();
  const [atlas, setAtlas] = useState<AtlasIndex | null>(null);
  const [polities, setPolities] = useState<PolityIndex | null>(null);
  const [disputes, setDisputes] = useState<Disputes | null>(null);
  const [waterLabels, setWaterLabels] = useState<FeatureCollection<Point, WaterLabelProps> | null>(null);
  const [year, setYear] = useState(initial.year);
  const [data, setData] = useState<WindowData | null>(null);
  /** The window the map is showing; it trails `data` while the map decodes new borders. */
  const [shownWindow, setShownWindow] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(initial.selection);
  const [focus, setFocus] = useState<FocusRequest | null>(
    initial.selection?.kind === "polity" && !location.hash ? { id: initial.selection.id, key: 0 } : null,
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[0] ?? 10);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [error, setError] = useState<"webgl" | "data" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const start = atlas?.start ?? 0;
  const end = atlas?.end ?? 2026;
  const currentWindow = atlas ? windowFor(atlas, year) : undefined;
  // The map only needs to re-filter in years where something changes: between them, every
  // year shows the same shapes as the last change before it.
  const mapYear = atlas ? (previousIn(atlas.changes, year + 1) ?? start) : year;

  useEffect(() => {
    loadIndex()
      .then((index) => {
        setAtlas(index);
        setYear((y) => clampYear(y, index.start, index.end));
      })
      .catch(() => setError("data"));
    // Search, the info panel, disputed areas and water simply have less to show if these fail.
    loadPolities()
      .then(setPolities)
      .catch(() => {});
    loadDisputes()
      .then(setDisputes)
      .catch(() => {});
    loadWaterLabels()
      .then(setWaterLabels)
      .catch(() => {});
  }, []);

  // A window holds many years, so data only reloads when the year leaves it. While the slider
  // is being dragged across several windows, only the one it settles on is loaded.
  const settleDelay = useEffectEvent(() => (data && !playing ? 150 : 0));
  useEffect(() => {
    if (!atlas || !currentWindow) return;
    let stale = false;
    const timer = setTimeout(() => {
      loadWindow(currentWindow)
        .then((d) => {
          if (stale) return;
          setData(d);
          prefetchAround(atlas, currentWindow);
        })
        .catch(() => {
          // Moving the year to another period (or back) tries again.
          if (stale) return;
          setPlaying(false);
          setToast(t("windowError"));
        });
    }, settleDelay());
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [atlas, currentWindow, t]);

  // Playback: advance by `speed` years per second, but never past a window the map isn't showing.
  const playbackState = useEffectEvent(() => ({ year, shown: shownWindow }));
  useEffect(() => {
    if (!playing || !atlas) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      // Capped so that coming back to a hidden tab doesn't leap ahead by the time spent away.
      carry += (Math.min(now - last, 100) / 1000) * speed;
      last = now;
      const { year: current, shown } = playbackState();
      const ready = windowFor(atlas, current)?.id === shown;
      if (carry >= 1 && ready) {
        const step = Math.floor(carry);
        carry -= step;
        setYear((y) => Math.min(atlas.end, y + step));
        if (current + step >= atlas.end) {
          setPlaying(false);
          return;
        }
      }
      if (!ready) carry = Math.min(carry, 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, atlas]);

  // Keep the URL and title shareable: ?year=…&p=…&lang=… (the map keeps its own #zoom/lat/lng).
  const polityById = new Map((polities?.polities ?? []).map((p) => [p.id, p]));
  const selectedPolity = selected?.kind === "polity" ? polityById.get(selected.id) : undefined;
  const selectedDispute =
    selected?.kind === "dispute"
      ? disputes?.features.find((f) => f.properties.id === selected.id)?.properties
      : undefined;
  const currentLabel =
    selected?.kind === "polity"
      ? data?.labels.features.find(
          (f) => f.properties.id === selected.id && f.properties.f <= year && year <= f.properties.t,
        )?.properties
      : undefined;
  const currentName = currentLabel ? (lang === "tr" ? currentLabel.tr : currentLabel.en) : undefined;
  const selectedTitle =
    currentName ??
    (selectedPolity ? selectedPolity[lang].at(-1) : selectedDispute ? selectedDispute[lang] : undefined);

  useEffect(() => {
    document.title = `${selectedTitle ? `${selectedTitle} · ` : ""}${year} · Epochmap`;
  }, [year, selectedTitle]);

  // Browsers limit how often a page may rewrite its URL (Safari throws after 100 times in 10 s),
  // so the URL is only written once the view rests, never during playback.
  useEffect(() => {
    if (playing) return;
    const timer = setTimeout(() => {
      try {
        history.replaceState(history.state, "", urlFor(year, lang, selected));
      } catch {
        // Over the limit: the next change writes the URL again.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [year, lang, selected, playing]);

  // Empire the selected polity belongs to in this year.
  const group = currentLabel?.g;
  const groupPolity = group ? polityById.get(group) : undefined;
  const partOf = group
    ? {
        id: group,
        name: groupPolity ? (groupPolity[lang].at(-1) ?? group) : (polities?.groups[group]?.[lang] ?? group),
      }
    : undefined;

  const goTo = (y: number) => {
    setPlaying(false);
    setYear(clampYear(y, start, end));
  };

  const togglePlay = () => {
    if (!playing && year >= end) setYear(start);
    setPlaying(!playing);
  };

  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length] ?? s);

  const previousChange = () => {
    const y = atlas && previousIn(atlas.changes, year);
    if (y !== undefined && y !== null) goTo(y);
  };
  const nextChange = () => {
    const y = atlas && nextIn(atlas.changes, year);
    if (y !== undefined && y !== null) goTo(y);
  };

  /** Selects a polity and flies to it, moving to its nearest year on the map if it isn't there now. */
  const showPolity = (polity: Polity | undefined, targetYear?: number) => {
    if (!polity) return;
    let y = targetYear ?? year;
    if (targetYear === undefined && !polity.spans.some(([f, to]) => f <= year && year <= to)) {
      // Nearest year inside one of its spans.
      let best = Number.POSITIVE_INFINITY;
      for (const [f, to] of polity.spans) {
        const candidate = year < f ? f : to;
        if (Math.abs(candidate - year) < Math.abs(best - year)) best = candidate;
      }
      y = best;
    }
    goTo(y);
    setSelected({ kind: "polity", id: polity.id });
    setFocus({ id: polity.id, key: Date.now() });
  };

  const share = async () => {
    // Built from the current state: the address bar may still be waiting for its next update.
    const url = urlFor(year, lang, selected);
    try {
      await navigator.clipboard.writeText(url);
      setToast(t("linkCopied"));
    } catch {
      setToast(url);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || searchOpen || aboutOpen) return;
    const target = e.target as HTMLElement;
    // Text fields keep their keys; buttons and links keep Space and Enter; the slider handles
    // plain arrows itself.
    const isSlider = target.matches?.("input[type=range]");
    if (!isSlider && target.closest?.("input, textarea, select, [contenteditable]")) return;
    if ((e.key === " " || e.key === "Enter") && target.closest?.("button, a, summary, [role=button]")) return;

    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case "ArrowLeft":
        if (isSlider && !e.shiftKey) return;
        goTo(year - step);
        break;
      case "ArrowRight":
        if (isSlider && !e.shiftKey) return;
        goTo(year + step);
        break;
      case "PageUp":
        previousChange();
        break;
      case "PageDown":
        nextChange();
        break;
      case " ":
        togglePlay();
        break;
      case "/":
        setSearchOpen(true);
        break;
      case "Escape":
        setSelected(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    addEventListener("keydown", listener);
    return () => removeEventListener("keydown", listener);
  }, []);

  if (error) {
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-ink/80">{error === "webgl" ? t("webglError") : t("dataError")}</p>
          {error === "data" && (
            <button
              type="button"
              className="mt-5 rounded-full bg-gold px-5 py-2 font-medium text-space"
              onClick={() => location.reload()}
            >
              {t("reload")}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-full overflow-hidden">
      <GlobeMap
        data={data}
        disputes={disputes}
        waterLabels={waterLabels}
        year={year}
        mapYear={mapYear}
        lang={lang}
        selected={selected}
        focus={focus}
        onSelect={setSelected}
        onWindowShown={setShownWindow}
        onError={(kind) => {
          if (kind === "webgl") setError("webgl");
          else {
            setPlaying(false);
            setToast(t("windowError"));
          }
        }}
      />

      <TopBar onSearch={() => setSearchOpen(true)} onShare={share} onAbout={() => setAboutOpen(true)} />

      <div className="pointer-events-none absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[13.5rem] left-[max(0.75rem,env(safe-area-inset-left))] z-10 flex h-[40dvh] items-end justify-end sm:bottom-56 lg:top-20 lg:right-[max(1.25rem,env(safe-area-inset-right))] lg:left-auto lg:h-auto lg:w-[380px] lg:items-start short:top-16 short:right-[max(0.75rem,env(safe-area-inset-right))] short:bottom-[7.5rem] short:left-auto short:h-auto short:w-[min(340px,50vw)] short:items-start">
        {/* popLayout: a closing panel leaves the layout at once, so it never squeezes the next one. */}
        <AnimatePresence mode="popLayout">
          {selectedPolity && (
            <PolityPanel
              key={selectedPolity.id}
              polity={selectedPolity}
              currentName={currentName}
              partOf={partOf}
              year={year}
              start={start}
              end={end}
              onClose={() => setSelected(null)}
              onJump={(y) => showPolity(selectedPolity, y)}
              onSelect={(id) => showPolity(polityById.get(id))}
            />
          )}
          {selectedDispute && (
            <DisputePanel
              key={selectedDispute.id}
              dispute={selectedDispute}
              onClose={() => setSelected(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pt-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:pt-5 sm:pr-[max(1.25rem,env(safe-area-inset-right))] sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] short:pt-2 short:pr-[max(0.5rem,env(safe-area-inset-right))] short:pb-[max(0.5rem,env(safe-area-inset-bottom))] short:pl-[max(0.5rem,env(safe-area-inset-left))]">
        {atlas ? (
          <Timeline
            start={start}
            end={end}
            year={year}
            changes={atlas.changes}
            playing={playing}
            speed={speed}
            onYear={goTo}
            onTogglePlay={togglePlay}
            onCycleSpeed={cycleSpeed}
            onPreviousChange={previousChange}
            onNextChange={nextChange}
          />
        ) : (
          <div className="rounded-full border border-white/10 bg-panel px-4 py-2 text-ink/60 text-sm backdrop-blur-xl">
            {t("loading")}
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="-translate-x-1/2 pointer-events-none absolute top-20 left-1/2 z-30 max-w-[90vw] truncate rounded-full border border-white/10 bg-panel px-4 py-2 text-ink text-sm shadow-xl backdrop-blur-xl"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <SearchPalette
        open={searchOpen}
        polities={polities?.polities ?? []}
        end={end}
        onClose={() => setSearchOpen(false)}
        onPick={(polity) => {
          setSearchOpen(false);
          showPolity(polity);
        }}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}
