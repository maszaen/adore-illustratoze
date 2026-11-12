/**
 * Scroll horizontal-only strips (control bar, tabs, chip rows) with a plain mouse wheel.
 * Windows normally needs Shift+wheel for that; this lets one hand do it.
 *
 * Rules: the nearest scrollable ancestor of the pointer wins. If it scrolls vertically, the browser
 * handles the wheel as usual. If it only scrolls horizontally, vertical wheel motion moves it
 * sideways. At either end the event is left alone, so an outer area can still scroll.
 * Handlers that already called preventDefault (the canvas zoom/pan, number scrubbers) are respected.
 */
const scrolls = (value: string) => value === 'auto' || value === 'scroll';

export function horizontalWheelTarget(start: Element | null): HTMLElement | null {
  for (let el = start; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    if (scrolls(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return null;
    if (scrolls(style.overflowX) && el.scrollWidth > el.clientWidth + 1) return el;
  }
  return null;
}

export function installHorizontalWheel(target: Document | HTMLElement = document): () => void {
  const onWheel = (event: Event) => {
    const e = event as WheelEvent;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // trackpads already scroll sideways
    const el = horizontalWheelTarget(e.target as Element | null);
    if (!el) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
    const max = el.scrollWidth - el.clientWidth;
    const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY * unit));
    if (next === el.scrollLeft) return;
    el.scrollLeft = next;
    e.preventDefault();
  };
  target.addEventListener('wheel', onWheel, { passive: false });
  return () => target.removeEventListener('wheel', onWheel);
}
