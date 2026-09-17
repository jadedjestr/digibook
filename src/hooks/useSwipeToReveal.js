import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

// One row's actions revealed at a time, app-wide. Module-private: nothing
// outside this file needs to read it, and there's no shared ancestor close
// to the app root worth wiring a Context through for - today - two deeply
// nested consumers (AccountRow, PendingTransactionRow).
let activeId = null;
const listeners = new Set();

function setActiveId(id) {
  activeId = id;
  listeners.forEach(listener => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getActiveId() {
  return activeId;
}

// Movement below this is still "maybe a tap" - only once it's crossed do we
// commit to horizontal (swipe) or vertical (let the page scroll) and never
// reconsider for the rest of this gesture.
const DIRECTION_LOCK_PX = 8;

// Fraction of railWidth a release must have crossed to snap open instead of
// snapping back closed.
const OPEN_RATIO = 0.4;

/**
 * Bidirectional swipe-to-reveal for a horizontal list row: drag left to
 * reveal a right-side rail, drag right to reveal a left-side rail, each up
 * to `railWidth` px. Existing tap-target buttons elsewhere in the row are
 * untouched - this only tracks an offset for the caller to apply as a
 * transform, and coordinates so only one row is ever open at a time.
 */
export function useSwipeToReveal({ railWidth = 72, disabled = false } = {}) {
  const rowId = useId();
  const globalActiveId = useSyncExternalStore(subscribe, getActiveId);

  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef(null);
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    startOffset: 0,
    axis: null,
  });

  // Another row claimed "active" (or nothing is active anymore) - snap this
  // one shut. Deliberately keyed only on [globalActiveId, rowId], not
  // `offset` - this should re-run once per active-row change, not once per
  // drag frame.
  useEffect(() => {
    if (globalActiveId !== rowId) {
      setOffset(0);
    }
  }, [globalActiveId, rowId]);

  const onTouchStart = useCallback(
    e => {
      if (disabled) return;
      const touch = e.touches[0];
      gestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startOffset: offset,
        axis: null,
      };
    },
    [disabled, offset],
  );

  const handleTouchMove = useCallback(
    e => {
      if (disabled) return;
      const touch = e.touches[0];
      const gesture = gestureRef.current;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;

      if (gesture.axis === null) {
        if (
          Math.abs(dx) < DIRECTION_LOCK_PX &&
          Math.abs(dy) < DIRECTION_LOCK_PX
        ) {
          return;
        }
        gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        if (gesture.axis === 'horizontal') {
          setIsDragging(true);
          setActiveId(rowId);
        }
      }

      if (gesture.axis !== 'horizontal') return;

      // Requires the native, non-passive listener below - a JSX
      // onTouchMove's preventDefault() would be a silent no-op.
      e.preventDefault();
      const clamped = Math.max(
        -railWidth,
        Math.min(railWidth, gesture.startOffset + dx),
      );
      setOffset(clamped);
    },
    [disabled, railWidth, rowId],
  );

  // React's root-level touch listeners are { passive: true } by default, so
  // e.preventDefault() inside a JSX onTouchMove handler does nothing and the
  // page scrolls during a swipe anyway. A real addEventListener with
  // { passive: false } is the only way to make it stick.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return undefined;
    node.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => node.removeEventListener('touchmove', handleTouchMove);
  }, [handleTouchMove]);

  const onTouchEnd = useCallback(() => {
    if (disabled) return;
    const gesture = gestureRef.current;
    if (gesture.axis !== 'horizontal') {
      gesture.axis = null;
      return;
    }
    setIsDragging(false);

    setOffset(current => {
      const threshold = railWidth * OPEN_RATIO;
      if (current >= threshold) {
        setActiveId(rowId);
        return railWidth;
      }
      if (current <= -threshold) {
        setActiveId(rowId);
        return -railWidth;
      }

      // Read the singleton directly rather than the closed-over
      // globalActiveId - this callback isn't rebuilt on every active-id
      // change, so that value can be stale.
      if (getActiveId() === rowId) setActiveId(null);
      return 0;
    });

    gesture.axis = null;
  }, [disabled, railWidth, rowId]);

  const close = useCallback(() => {
    setOffset(0);
    if (getActiveId() === rowId) setActiveId(null);
  }, [rowId]);

  let openDirection = null;
  if (offset > 0) openDirection = 'left';
  else if (offset < 0) openDirection = 'right';

  return {
    offset,
    openDirection,
    isDragging,
    bind: { ref: contentRef, onTouchStart, onTouchEnd },
    close,
  };
}
