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
  loadWindow,
  type Polity,
  type PolityIndex,
  prefetchAround,
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

const initial = readUrl();

export function App() {
  const t = useT();
  const lang = useLang();
  const [atlas, setAtlas] = useState<AtlasIndex | null>(null);
  const [polities, setPolities] = useState<PolityIndex | null>(null);
  const [disputes, setDisputes] = useState<Disputes | null>(null);
  const [year, setYear] = useState(initial.year);
  const [data, setData] = useState<WindowData | null>(null);
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

  useEffect(() => {
    loadIndex()
      .then((index) => {
        setAtlas(index);
        setYear((y) => clampYear(y, index.start, index.end));
      })
      .catch(() => setError("data"));
    // Search, the info panel and disputed areas simply have less to show if these fail.
    loadPolities()
      .then(setPolities)
      .catch(() => {});
    loadDisputes()
      .then(setDisputes)
      .catch(() => {});
  }, []);

  // A window holds many years, so data only reloads when the year leaves it.
  useEffect(() => {
    if (!atlas || !currentWindow) return;
    let stale = false;
    loadWindow(currentWindow)
      .then((d) => !stale && setData(d))
      .catch(() => !stale && setError("data"));
    prefetchAround(atlas, currentWindow);
    return () => {
      stale = true;
    };
  }, [atlas, currentWindow]);

  // Playback: advance by `speed` years per second, but never past a window that hasn't loaded yet.
  const playbackState = useEffectEvent(() => ({ year, loaded: data?.window.id }));
  useEffect(() => {
    if (!playing || !atlas) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry += ((now - last) / 1000) * speed;
      last = now;
      const { year: current, loaded } = playbackState();
      const ready = windowFor(atlas, current)?.id === loaded;
      if (carry >= 1 && ready) {
        const step = Math.floor(carry);
        carry -= step;
        const next = Math.min(atlas.end, current + step);
        setYear(next);
        if (next >= atlas.end) {
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
    const url = new URL(location.href);
    url.searchParams.set("year", String(year));
    url.searchParams.set("lang", lang);
    url.searchParams.delete("p");
    url.searchParams.delete("d");
    if (selected) url.searchParams.set(selected.kind === "polity" ? "p" : "d", selected.id);
    history.replaceState(history.state, "", url);
    document.title = `${selectedTitle ? `${selectedTitle} · ` : ""}${year} · Epochmap`;
  }, [year, lang, selected, selectedTitle]);

  // Empire the selected polity belongs to in this year.
  const group =
    selected?.kind === "polity"
      ? data?.borders.features.find(
          (f) => f.properties.id === selected.id && f.properties.f <= year && year <= f.properties.t,
        )?.properties.g
      : undefined;
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
    try {
      await navigator.clipboard.writeText(location.href);
      setToast(t("linkCopied"));
    } catch {
      setToast(location.href);
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
    // Text fields, buttons and links handle their own keys; the slider handles plain arrows itself.
    const isSlider = target.matches?.("input[type=range]");
    if (!isSlider && target.closest?.("input, textarea, select, button, a, [contenteditable]")) return;

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
        year={year}
        lang={lang}
        selected={selected}
        focus={focus}
        onSelect={setSelected}
        onError={(kind) => setError(kind)}
      />

      <TopBar onSearch={() => setSearchOpen(true)} onShare={share} onAbout={() => setAboutOpen(true)} />

      <div className="pointer-events-none absolute inset-x-3 top-16 bottom-56 z-10 flex justify-end sm:top-20 lg:right-5 lg:left-auto lg:w-[380px]">
        <AnimatePresence>
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 sm:p-5">
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
