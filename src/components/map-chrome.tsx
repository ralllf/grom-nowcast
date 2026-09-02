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
        // 128px = SHEET_PEEK_PX. sm+ lifts above the IMGW aside (max-h-72 + pad).
        "bottom-[calc(128px+env(safe-area-inset-bottom,0px)+0.75rem)] sm:bottom-[21rem]",
      )}
    >
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl bg-surface/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Przybliż"
          onClick={onZoomIn}
          className="rounded-none"
        >
          <Plus className="size-5" />
        </Button>
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
        className="pointer-events-auto shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
      >
        <Crosshair className="size-5" />
      </Button>

      <div
        className="flex items-center gap-1.5 rounded-xl bg-surface/90 px-2 py-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md"
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

      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-col items-center rounded-md bg-surface/90 px-1.5 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md">
          <span className="font-mono text-xs tabular-nums text-fg">{scale.label}</span>
          <span className="mt-0.5 h-0.5 bg-fg" style={{ width: Math.max(24, scale.widthPx) }} />
        </div>
        <p id="grom-map-credit" className="rounded-md bg-surface/90 px-1.5 py-0.5 text-xs text-muted">
          {MAP_CREDIT}
        </p>
      </div>
    </div>
  );
}
