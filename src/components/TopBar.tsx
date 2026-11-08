import { Info, Link2, Search } from "lucide-react";
import { t } from "../lib/i18n";
import { GitHubIcon, Logo, REPO_URL } from "./Logo";

const isMac = /mac|iphone|ipad/i.test(globalThis.navigator?.userAgent ?? "");

type Props = {
  onSearch: () => void;
  onShare: () => void;
  onAbout: () => void;
};

export function TopBar({ onSearch, onShare, onAbout }: Props) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-5">
      <div className="pointer-events-auto flex items-center gap-3">
        <Logo className="size-9 drop-shadow-[0_0_12px_rgba(232,201,138,0.35)]" />
        <div>
          <h1 className="font-display font-semibold text-ink text-xl leading-none tracking-tight">
            Epochmap
          </h1>
          <p className="mt-1 hidden text-ink/55 text-xs sm:block">{t("tagline")}</p>
        </div>
      </div>

      <nav className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-panel px-3.5 text-ink/75 text-sm shadow-black/30 shadow-lg backdrop-blur-xl transition hover:text-ink sm:min-w-56"
          aria-label={t("search")}
        >
          <Search size={16} />
          <span className="hidden flex-1 text-left sm:inline">{t("searchPlaceholder")}</span>
          <kbd className="hidden rounded-md border border-white/15 px-1.5 font-sans text-[11px] text-ink/50 sm:inline">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
        <button
          type="button"
          className="icon-button glass"
          onClick={onShare}
          aria-label={t("share")}
          title={t("share")}
        >
          <Link2 size={17} />
        </button>
        <button
          type="button"
          className="icon-button glass"
          onClick={onAbout}
          aria-label={t("about")}
          title={t("about")}
        >
          <Info size={17} />
        </button>
        <a
          className="icon-button glass hidden sm:grid"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <GitHubIcon className="size-[17px]" />
        </a>
      </nav>
    </header>
  );
}
