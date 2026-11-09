import { CornerDownLeft, Search } from "lucide-react";
import { useState } from "react";
import type { Polity } from "../data/atlas";
import { useLang, useT } from "../lib/i18n";
import { searchPolities } from "../lib/search";
import { formatSpans } from "../lib/years";
import { Dialog } from "./Dialog";

type Props = {
  open: boolean;
  polities: Polity[];
  end: number;
  onClose: () => void;
  onPick: (polity: Polity) => void;
};

export function SearchPalette({ open, polities, end, onClose, onPick }: Props) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} label={t("search")} className="mt-[12vh] mb-auto">
      <SearchBody polities={polities} end={end} onPick={onPick} />
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so every opening starts with an empty query. */
function SearchBody({
  polities,
  end,
  onPick,
}: {
  polities: Polity[];
  end: number;
  onPick: (p: Polity) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = searchPolities(polities, query);

  const move = (delta: number) => {
    if (results.length) setActive((i) => (i + delta + results.length) % results.length);
  };

  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="flex items-center gap-3 border-white/10 border-b px-5">
        <Search size={18} className="shrink-0 text-ink/50" />
        <input
          // biome-ignore lint/a11y/noAutofocus: focusing the field is the point of opening search
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") move(1);
            else if (e.key === "ArrowUp") move(-1);
            else if (e.key === "Enter" && results[active]) onPick(results[active]);
            else return;
            e.preventDefault();
          }}
          placeholder={t("searchPlaceholder")}
          className="h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/40"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `result-${active}` : undefined}
          aria-autocomplete="list"
        />
      </div>

      {query.trim() === "" || results.length === 0 ? (
        <p className="px-5 py-8 text-center text-ink/45 text-sm">
          {query.trim() === "" ? t("searchHint") : t("noResults")}
        </p>
      ) : (
        // Keyboard focus stays in the input (combobox pattern); options are picked with arrows + Enter.
        <div
          id="search-results"
          role="listbox"
          className="flex-1 overflow-y-auto p-2"
          aria-label={t("search")}
        >
          {results.map((polity, i) => {
            const names = polity[lang];
            const name = names.at(-1) ?? polity.en.at(-1) ?? polity.id;
            const earlier = names.slice(0, -1).slice(-2);
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled by the combobox input
              <div
                key={polity.id}
                id={`result-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => onPick(polity)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
                  i === active ? "bg-white/10" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{name}</p>
                  <p className="truncate text-ink/50 text-xs tabular-nums">
                    {formatSpans(polity.spans, end, String(end))}
                    {earlier.length > 0 && ` · ${earlier.join(", ")}`}
                  </p>
                </div>
                {i === active && <CornerDownLeft size={16} className="shrink-0 text-ink/40" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
