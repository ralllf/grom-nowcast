import { Crosshair, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHEET_PEEK_PX } from "@/components/threat-sheet-logic";
import { LEVEL_SWATCH } from "@/lib/weather/palette";
import { cn } from "@/lib/utils";
import { MAP_CREDIT } from "@/components/map-chrome-logic";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  locatePending?: boolean;
  scale: { label: string; widthPx: number };
};

const RAIN_LEVELS = [1, 2, 3, 4] as const;

export function MapChrome({ onZoomIn, onZoomOut, onLocate, locatePending = false, scale }: Props) {
  return (
    <div
      id="grom-map-chrome"
      data-peek={SHEET_PEEK_PX}
      className={cn(
        "pointer-events-none fixed right-3 z-10 flex flex-col items-end gap-2 sm:right-5",
        // 128px = SHEET_PEEK_PX. sm+ lifts above the IMGW lane card (≤2 clamped rows).
        "bottom-[calc(128px+env(safe-area-inset-bottom,0px)+0.75rem)] sm:bottom-[22rem]",
      )}
    >
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-2xl bg-surface/90 shadow-chip backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Przybliż"
          onClick={onZoomIn}
          className="rounded-none"
        >
          <Plus className="size-5" />
        </Button>
        <span className="mx-auto h-px w-6 bg-border" aria-hidden />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Oddal"
          onClick={onZoomOut}
          className="rounded-none"
        >
          <Minus className="size-5" />
        </Button>
      </div>

      <Button
        variant="subtle"
        size="icon"
        aria-label="Wybierz lokalizację"
        onClick={onLocate}
        disabled={locatePending}
        className="pointer-events-auto"
      >
        <Crosshair className="size-5" />
      </Button>

      <div
        className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-2 shadow-chip backdrop-blur-md"
        aria-label="Legenda opadu"
      >
        {RAIN_LEVELS.map((level) => (
          <span
            key={level}
            className="inline-block size-2.5 rounded-sm"
            style={{ backgroundColor: LEVEL_SWATCH[level] }}
          />
        ))}
        <span aria-hidden className="relative ml-0.5 inline-flex h-2.5 w-5 items-center">
          <span className="h-[2px] w-full bg-[#f0a202]" />
          <span className="absolute right-0 size-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-[#f0a202]" />
        </span>
        <span
          className="inline-block size-2.5 rounded-sm"
          style={{ backgroundColor: "rgba(201,163,106,0.75)" }}
          title="IMGW"
        />
      </div>

      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 shadow-chip backdrop-blur-md">
        <span className="font-mono text-xs tabular-nums text-fg">{scale.label}</span>
        <span className="h-0.5 bg-fg" style={{ width: Math.max(24, scale.widthPx) }} />
        <span className="h-3 w-px bg-border" aria-hidden />
        <p id="grom-map-credit" className="text-xs text-muted">
          {MAP_CREDIT}
        </p>
      </div>
    </div>
  );
}
