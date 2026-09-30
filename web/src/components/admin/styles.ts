export const fieldClass =
  "text-base h-11 min-h-11 w-full touch-manipulation rounded-lg border border-input bg-background px-3 outline-none transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] placeholder:text-muted-foreground focus-visible:border-canvas focus-visible:ring-3 focus-visible:ring-canvas/15 sm:type-caption sm:h-9 sm:min-h-9";

/** Mobile-first touch target; denser from `sm` (matches public CTAs). */
export const touchControl =
  "min-h-11 touch-manipulation text-base sm:min-h-8 sm:text-sm";

/** Same as touchControl but restores `lg` / h-9 desktop height. */
export const touchControlLg =
  "min-h-11 touch-manipulation text-base sm:min-h-9 sm:text-sm";

export const touchIcon = "size-11 touch-manipulation sm:size-8";

export const quietCta =
  "border-canvas/25 bg-transparent text-canvas hover:bg-canvas/10 hover:text-canvas";

export const panelClass = "overflow-hidden rounded-2xl bg-paper shadow-paper";

export const subtleText = "text-ink/60";

export const rowHover =
  "transition-colors duration-200 hover:bg-canvas/6 focus-visible:bg-canvas/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-canvas/40";
