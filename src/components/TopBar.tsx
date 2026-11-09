import { Info, Link2, Search } from "lucide-react";
import { LANGS, setLang, useLang, useT } from "../lib/i18n";
import { GitHubIcon, Logo, REPO_URL } from "./Logo";

const isMac = /mac|iphone|ipad/i.test(globalThis.navigator?.userAgent ?? "");

type Props = {
  onSearch: () => void;
  onShare: () => void;
  onAbout: () => void;
};

export function TopBar({ onSearch, onShare, onAbout }: Props) {
  const t = useT();
  const lang = useLang();
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-3 pl-[max(0.75rem,env(safe-area-inset-left))] sm:pt-[max(1.25rem,env(safe-area-inset-top))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] short:pt-[max(0.5rem,env(safe-area-inset-top))] short:pr-[max(0.5rem,env(safe-area-inset-right))] short:pl-[max(0.5rem,env(safe-area-inset-left))]">
      <div className="glass pointer-events-auto flex shrink-0 items-center gap-3 rounded-2xl py-1.5 pr-2 pl-2 min-[390px]:pr-4">
        <Logo className="size-9 drop-shadow-[0_0_12px_rgba(232,201,138,0.35)]" />
        {/* The narrowest phones show the logo alone; the name stays for screen readers. */}
        <div className="sr-only min-[390px]:not-sr-only">
          <h1 className="font-display font-semibold text-ink text-xl leading-none tracking-tight">
            Epochmap
          </h1>
          <p className="mt-1 hidden text-ink/55 text-xs lg:block">{t("tagline")}</p>
        </div>
      </div>

      <nav className="pointer-events-auto flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="glass flex h-10 min-w-0 shrink-0 items-center gap-2 rounded-full px-3.5 text-ink/75 text-sm transition hover:text-ink focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 sm:w-60 sm:shrink lg:w-72"
          aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        >
          <Search size={16} aria-hidden />
          <span className="sr-only sm:hidden">{t("search")}</span>
          <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">{t("searchPlaceholder")}</span>
          <kbd
            aria-hidden
            className="hidden rounded-md border border-white/15 px-1.5 font-sans text-[11px] text-ink/60 sm:inline"
          >
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>

        {/* Language switch */}
        <fieldset
          className="glass flex h-10 shrink-0 items-center rounded-full p-1"
          aria-label={t("language")}
        >
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`h-8 rounded-full px-2.5 font-medium text-xs uppercase tracking-wide transition focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1 ${
                lang === l ? "bg-gold text-space" : "text-ink/60 hover:text-ink"
              }`}
              lang={l}
            >
              {l}
            </button>
          ))}
        </fieldset>

        <button
          type="button"
          className="icon-button glass hidden shrink-0 sm:grid"
          onClick={onShare}
          aria-label={t("share")}
          title={t("share")}
        >
          <Link2 size={17} />
        </button>
        <button
          type="button"
          className="icon-button glass shrink-0"
          onClick={onAbout}
          aria-label={t("about")}
          title={t("about")}
        >
          <Info size={17} />
        </button>
        <a
          className="icon-button glass hidden shrink-0 lg:grid"
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
