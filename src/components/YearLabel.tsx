import { lang, t } from "../lib/i18n";
import { yearParts } from "../lib/years";

/** A year with its BCE/CE marker set smaller, in the order the UI language expects. */
export function YearLabel({ year, markerClassName }: { year: number; markerClassName?: string }) {
  const { value, marker, markerFirst } = yearParts(year, lang, { bce: t("bce"), ce: t("ce") });
  const markerEl = marker ? <span className={markerClassName}>{marker}</span> : null;
  return (
    <span className="whitespace-nowrap">
      {markerFirst && markerEl}
      {markerFirst && marker ? " " : null}
      {value}
      {!markerFirst && marker ? " " : null}
      {!markerFirst && markerEl}
    </span>
  );
}
