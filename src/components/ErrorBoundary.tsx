import { Component, type ReactNode } from "react";
import { getLang, translate } from "../lib/i18n";

/** The last line of defence: an unexpected error offers a reload instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const lang = getLang();
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-ink/80">{translate(lang, "crashed")}</p>
          <button
            type="button"
            className="mt-5 rounded-full bg-gold px-5 py-2 font-medium text-space"
            onClick={() => location.reload()}
          >
            {translate(lang, "reload")}
          </button>
        </div>
      </main>
    );
  }
}
