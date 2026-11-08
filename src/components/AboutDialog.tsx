import { X } from "lucide-react";
import { t } from "../lib/i18n";
import { Dialog } from "./Dialog";
import { GitHubIcon, REPO_URL } from "./Logo";

const isMac = /mac|iphone|ipad/i.test(globalThis.navigator?.userAgent ?? "");

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shortcuts: [string, string][] = [
    ["← →", t("shortcut.step")],
    ["Space", t("shortcut.play")],
    [isMac ? "⌘ K" : "Ctrl K", t("shortcut.search")],
    ["Esc", t("shortcut.close")],
  ];

  return (
    <Dialog open={open} onClose={onClose} label={t("aboutTitle")}>
      <div className="max-h-[inherit] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display font-semibold text-3xl">{t("aboutTitle")}</h2>
          <button type="button" className="icon-button -mr-2" onClick={onClose} aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-ink/80 leading-relaxed">{t("aboutBody")}</p>

        <h3 className="mt-7 text-ink/55 text-xs uppercase tracking-[0.16em]">{t("shortcuts")}</h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {shortcuts.map(([keys, label]) => (
            <div key={keys} className="contents">
              <dt>
                <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-ink/80 text-xs">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-ink/75">{label}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-7 text-ink/55 text-xs uppercase tracking-[0.16em]">{t("disclaimerTitle")}</h3>
        <p className="mt-2 text-ink/75 text-sm leading-relaxed">{t("disclaimer")}</p>

        <h3 className="mt-7 text-ink/55 text-xs uppercase tracking-[0.16em]">{t("dataTitle")}</h3>
        <ul className="mt-2 space-y-1.5 text-ink/75 text-sm">
          <li>
            <a
              className="link"
              href="https://github.com/aourednik/historical-basemaps"
              target="_blank"
              rel="noreferrer"
            >
              {t("dataBorders")}
            </a>
          </li>
          <li>
            <a className="link" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
              {t("dataLand")}
            </a>
          </li>
          <li>
            <a className="link" href="https://www.wikipedia.org/" target="_blank" rel="noreferrer">
              {t("dataWiki")}
            </a>
          </li>
        </ul>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-sm transition hover:bg-white/10"
        >
          <GitHubIcon className="size-4" />
          {t("sourceCode")}
        </a>
      </div>
    </Dialog>
  );
}
