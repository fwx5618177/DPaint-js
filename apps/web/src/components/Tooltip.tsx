import { useEffect, useState } from "react";

/**
 * Floating tooltip, ported from the legacy `info` hover system. Any element with
 * a `data-tip` attribute shows its text near the cursor on hover.
 */
export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = (e.target as HTMLElement | null)?.closest?.("[data-tip]") as HTMLElement | null;
        const text = el?.getAttribute("data-tip");
        if (el && text) setTip({ text, x: e.clientX, y: e.clientY });
        else setTip(null);
      });
    };
    const onLeave = () => setTip(null);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onLeave, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onLeave);
    };
  }, []);

  if (!tip) return null;
  // keep the tooltip on-screen near the cursor
  const left = Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 220);
  return (
    <div className="floating-tooltip" data-testid="tooltip" style={{ left, top: tip.y + 18 }}>
      {tip.text}
    </div>
  );
}
