import { AnimatePresence, motion } from "motion/react";
import { useEffect, useEffectEvent, useState } from "react";
import { AboutDialog } from "./components/AboutDialog";
import { type FocusRequest, GlobeMap } from "./components/GlobeMap";
import { InfoPanel } from "./components/InfoPanel";
import { SearchPalette } from "./components/SearchPalette";
import { Timeline } from "./components/Timeline";
import { TopBar } from "./components/TopBar";
import {
  type AtlasIndex,
  loadIndex,
  loadSearchIndex,
  loadSnapshot,
  prefetchSnapshot,
  type SnapshotData,
} from "./data/atlas";
import { lang, t } from "./lib/i18n";
import type { SearchEntry } from "./lib/search";
import { formatYear, nearestIndex } from "./lib/years";

/** Opening year: the Mongol Empire at its largest is a striking first view. */
const DEFAULT_YEAR = 1279;
const PLAY_STEP_MS = 1800;

function readUrl() {
  const params = new URLSearchParams(location.search);
  const year = Number(params.get("year"));
  return {
    year: params.has("year") && Number.isFinite(year) ? year : DEFAULT_YEAR,
    polity: params.get("p"),
  };
}

const initial = readUrl();

export function App() {
  const [atlas, setAtlas] = useState<AtlasIndex | null>(null);
  const [position, setPosition] = useState(0);
  const [data, setData] = useState<SnapshotData | null>(null);
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(initial.polity);
  const [focus, setFocus] = useState<FocusRequest | null>(
    initial.polity && !location.hash ? { name: initial.polity, key: 0 } : null,
  );
  const [playing, setPlaying] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [error, setError] = useState<"webgl" | "data" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const snapshots = atlas?.snapshots ?? [];
  const snapshot = snapshots[position];

  useEffect(() => {
    loadIndex()
      .then((index) => {
        setAtlas(index);
        setPosition(
          nearestIndex(
            index.snapshots.map((s) => s.year),
            initial.year,
          ),
        );
      })
      .catch(() => setError("data"));
    loadSearchIndex()
      .then(setEntries)
      .catch(() => {}); // search and the info panel simply have less to show
  }, []);

  // Load the snapshot on screen and warm up its neighbours.
  useEffect(() => {
    if (!snapshot) return;
    let stale = false;
    loadSnapshot(snapshot)
      .then((d) => !stale && setData(d))
      .catch(() => !stale && setError("data"));
    prefetchSnapshot(snapshots[position + 1]);
    prefetchSnapshot(snapshots[position - 1]);
    return () => {
      stale = true;
    };
  }, [snapshot, snapshots, position]);

  // Playback advances only after the current snapshot has loaded, so it never outruns the network.
  useEffect(() => {
    if (!playing || !snapshot || data?.snapshot !== snapshot) return;
    if (position >= snapshots.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setPosition((p) => p + 1), PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, data, snapshot, position, snapshots.length]);

  // Keep the URL and title shareable: ?year=…&p=… (the map keeps its own #zoom/lat/lng).
  useEffect(() => {
    if (!snapshot) return;
    const url = new URL(location.href);
    url.searchParams.set("year", String(snapshot.year));
    if (selected) url.searchParams.set("p", selected);
    else url.searchParams.delete("p");
    history.replaceState(history.state, "", url);
    const year = formatYear(snapshot.year, lang, { bce: t("bce"), ce: t("ce") });
    document.title = `${selected ? `${selected} · ` : ""}${year} · Epochmap`;
  }, [snapshot, selected]);

  const goTo = (index: number) => {
    setPlaying(false);
    setPosition(Math.max(0, Math.min(snapshots.length - 1, index)));
  };

  const togglePlay = () => {
    if (!playing && position >= snapshots.length - 1) setPosition(0);
    setPlaying(!playing);
  };

  /** Shows a polity: moves to the snapshot nearest the current year in which it exists, then flies there. */
  const showPolity = (name: string, year?: number) => {
    const entry = entries.find((e) => e.name === name);
    const current = snapshot?.year ?? DEFAULT_YEAR;
    const target = year ?? (entry ? entry.years[nearestIndex(entry.years, current)] : current);
    const index = snapshots.findIndex((s) => s.year === target);
    if (index >= 0) goTo(index);
    setSelected(name);
    setFocus({ name, key: Date.now() });
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
    // Let text fields, buttons and links handle their own keys; the timeline slider handles arrows itself.
    const isSlider = target.matches?.("input[type=range]");
    if (!isSlider && target.closest?.("input, textarea, select, button, a, [contenteditable]")) return;

    switch (e.key) {
      case "ArrowLeft":
        if (isSlider) return;
        goTo(position - 1);
        break;
      case "ArrowRight":
        if (isSlider) return;
        goTo(position + 1);
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
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const polity = selected
    ? data?.borders.features.find((f) => f.properties.name === selected)?.properties
    : undefined;

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
        selected={selected}
        focus={focus}
        onSelect={(name) => setSelected(name)}
        onError={(kind) => setError(kind)}
      />

      <TopBar onSearch={() => setSearchOpen(true)} onShare={share} onAbout={() => setAboutOpen(true)} />

      <div className="pointer-events-none absolute inset-x-3 top-16 bottom-48 z-10 flex justify-end sm:top-20 lg:right-5 lg:left-auto lg:w-[380px]">
        <AnimatePresence>
          {selected && snapshot && (
            <InfoPanel
              key={selected}
              name={selected}
              polity={polity}
              entry={entries.find((e) => e.name === selected)}
              snapshots={snapshots}
              currentYear={snapshot.year}
              onClose={() => setSelected(null)}
              onJump={(year) => showPolity(selected, year)}
              onSelect={(name) => showPolity(name)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 sm:p-5">
        {atlas ? (
          <Timeline
            snapshots={snapshots}
            index={position}
            playing={playing}
            onChange={goTo}
            onTogglePlay={togglePlay}
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
        entries={entries}
        onClose={() => setSearchOpen(false)}
        onPick={(entry) => {
          setSearchOpen(false);
          showPolity(entry.name);
        }}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}
