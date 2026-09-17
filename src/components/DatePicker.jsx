import PropTypes from 'prop-types';
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';

import { DateUtils } from '../utils/dateUtils';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

const clampCode = (y, m, d) => {
  const yearPart = y * 372;
  const monthPart = m * 31;
  return yearPart + monthPart + d;
};

const isOutOfRange = (y, m, d, min, max) => {
  const code = clampCode(y, m, d);
  if (min) {
    const mp = DateUtils.parseDate(min);
    if (code < clampCode(mp.getFullYear(), mp.getMonth(), mp.getDate())) {
      return true;
    }
  }
  if (max) {
    const mp = DateUtils.parseDate(max);
    if (code > clampCode(mp.getFullYear(), mp.getMonth(), mp.getDate())) {
      return true;
    }
  }
  return false;
};

/**
 * A calendar-popover date picker matching digibook's glass-surface look -
 * the replacement for every native <input type="date"> in the app (see
 * ARCHITECTURE.md's Component Inventory). Controlled: `value`/`onChange`
 * carry the same YYYY-MM-DD string every call site already used, so
 * swapping a native input for this one only ever changes how the value is
 * read (onChange(dateString) directly, not onChange(event)).
 *
 * `min`/`max` (YYYY-MM-DD, optional) disable out-of-range days in the
 * calendar itself, replacing the native input's min/max attributes -
 * those only grayed out the browser's own picker UI and never stopped
 * someone typing an out-of-range date by hand.
 */
const DatePicker = forwardRef(
  (
    { id, value, onChange, min, max, disabled, placeholder, className },
    forwardedRef,
  ) => {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('days');
    const parsedValue = value && DateUtils.isValidDate(value) ? value : null;
    const anchor = parsedValue || min || DateUtils.today();
    const anchorParsed = DateUtils.parseDate(anchor);
    const [viewYear, setViewYear] = useState(anchorParsed.getFullYear());
    const [viewMonth, setViewMonth] = useState(anchorParsed.getMonth());
    const [pendingFocusIso, setPendingFocusIso] = useState(null);
    const [popStyle, setPopStyle] = useState(null);

    const fieldRef = useRef(null);
    const triggerRef = useRef(null);
    const popRef = useRef(null);
    const dayButtonRefs = useRef(new Map());

    // Callers that used to ref a native <input> (e.g. InlineEdit's
    // focus-on-edit-start) get the trigger button instead - same
    // focus()/blur() surface.
    useImperativeHandle(forwardedRef, () => ({
      focus: () => triggerRef.current?.focus(),
      blur: () => triggerRef.current?.blur(),
    }));

    // Fixed-position, computed from the trigger's own rect - immune to any
    // ancestor modal's overflow:hidden/auto clipping, unlike a plain
    // position:absolute popover would be inside a scrollable form.
    useLayoutEffect(() => {
      if (!open) {
        setPopStyle(null);
        return;
      }
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const popRect = popRef.current?.getBoundingClientRect();
      if (!triggerRect || !popRect) return;
      const gutter = 16;
      let left = triggerRect.left;
      const overflowRight = left + popRect.width - (window.innerWidth - gutter);
      if (overflowRight > 0) left -= overflowRight;
      if (left < gutter) left = gutter;
      let top = triggerRect.bottom + 8;
      const overflowBottom =
        top + popRect.height - (window.innerHeight - gutter);
      if (overflowBottom > 0) {
        const above = triggerRect.top - 8 - popRect.height;
        top = above > gutter ? above : top;
      }
      setPopStyle({ top, left });
    }, [open, mode, viewYear, viewMonth]);

    const close = useCallback(() => {
      setOpen(false);
      setMode('days');
    }, []);

    const openPicker = useCallback(() => {
      if (disabled) return;
      const base = parsedValue || min || DateUtils.today();
      const p = DateUtils.parseDate(base);
      setViewYear(p.getFullYear());
      setViewMonth(p.getMonth());
      setMode('days');
      setOpen(true);
    }, [disabled, parsedValue, min]);

    // Outside click / Escape / scroll-away close.
    useEffect(() => {
      if (!open) return undefined;
      const onPointerDown = e => {
        const insideField = fieldRef.current?.contains(e.target);
        const insidePop = popRef.current?.contains(e.target);
        if (!insideField && !insidePop) close();
      };
      const onKeyDown = e => {
        if (e.key === 'Escape') {
          close();
          triggerRef.current?.focus();
        }
      };
      const onScroll = e => {
        if (popRef.current && popRef.current.contains(e.target)) return;
        close();
      };
      document.addEventListener('mousedown', onPointerDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', close);
      return () => {
        document.removeEventListener('mousedown', onPointerDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', close);
      };
    }, [open, close]);

    // Focus a day cell after an arrow-key navigation re-renders the grid.
    useEffect(() => {
      if (!pendingFocusIso) return;
      const btn = dayButtonRefs.current.get(pendingFocusIso);
      if (btn) btn.focus();
      setPendingFocusIso(null);
    }, [pendingFocusIso, viewYear, viewMonth]);

    const commit = iso => {
      onChange(iso);
      close();
      triggerRef.current?.focus();
    };

    const goMonth = delta => {
      let m = viewMonth + delta;
      let y = viewYear;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      setViewMonth(m);
      setViewYear(y);
    };

    const buildDays = () => {
      const first = new Date(viewYear, viewMonth, 1).getDay();
      const total = daysInMonth(viewYear, viewMonth);
      const prevTotal = daysInMonth(
        viewYear,
        viewMonth - 1 < 0 ? 11 : viewMonth - 1,
      );
      const pm = viewMonth - 1 < 0 ? 11 : viewMonth - 1;
      const py = viewMonth - 1 < 0 ? viewYear - 1 : viewYear;
      const nm = viewMonth + 1 > 11 ? 0 : viewMonth + 1;
      const ny = viewMonth + 1 > 11 ? viewYear + 1 : viewYear;

      const cells = [];
      for (let i = 0; i < first; i++) {
        cells.push({
          y: py,
          m: pm,
          d: prevTotal - first + 1 + i,
          muted: true,
        });
      }
      for (let d = 1; d <= total; d++) {
        cells.push({ y: viewYear, m: viewMonth, d, muted: false });
      }
      let after = 1;
      while (cells.length < 42) {
        cells.push({ y: ny, m: nm, d: after, muted: true });
        after++;
      }
      return cells;
    };

    const handleDayKeyDown = (e, iso) => {
      const deltas = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7,
      };
      const delta = deltas[e.key];
      if (delta === undefined) return;
      e.preventDefault();
      const p = DateUtils.parseDate(iso);
      const next = new Date(p.getFullYear(), p.getMonth(), p.getDate() + delta);
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
      setPendingFocusIso(DateUtils.formatDate(next));
    };

    const renderDaysView = () => {
      const cells = buildDays();
      const todayIso = DateUtils.today();
      return (
        <div>
          <div className='date-picker-head'>
            <button
              type='button'
              className='date-picker-nav-btn'
              aria-label='Previous month'
              onClick={() => goMonth(-1)}
            >
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M15 18l-6-6 6-6' />
              </svg>
            </button>
            <button
              type='button'
              className='date-picker-title-btn'
              onClick={() => setMode('months')}
            >
              {MONTH_NAMES[viewMonth]} {viewYear}
              <svg
                width='12'
                height='12'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
              >
                <path d='M6 9l6 6 6-6' />
              </svg>
            </button>
            <button
              type='button'
              className='date-picker-nav-btn'
              aria-label='Next month'
              onClick={() => goMonth(1)}
            >
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M9 18l6-6-6-6' />
              </svg>
            </button>
          </div>
          <div className='date-picker-weekdays'>
            {WEEKDAYS.map(w => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className='date-picker-days' role='grid'>
            {cells.map(c => {
              const iso = DateUtils.formatDate(new Date(c.y, c.m, c.d));
              const isDisabled = isOutOfRange(c.y, c.m, c.d, min, max);
              const isSelected = parsedValue === iso;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type='button'
                  ref={el => {
                    if (el) dayButtonRefs.current.set(iso, el);
                    else dayButtonRefs.current.delete(iso);
                  }}
                  className={[
                    'date-picker-day',
                    c.muted && 'is-muted',
                    isToday && 'is-today',
                    isSelected && 'is-selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={isDisabled}
                  aria-label={DateUtils.formatDisplayDate(iso)}
                  aria-pressed={isSelected}
                  onClick={() => commit(iso)}
                  onKeyDown={e => handleDayKeyDown(e, iso)}
                >
                  {c.d}
                </button>
              );
            })}
          </div>
          <div className='date-picker-foot'>
            <button
              type='button'
              className='date-picker-today-btn'
              onClick={() => {
                const t = DateUtils.today();
                const tp = DateUtils.parseDate(t);
                if (
                  isOutOfRange(
                    tp.getFullYear(),
                    tp.getMonth(),
                    tp.getDate(),
                    min,
                    max,
                  )
                ) {
                  setViewYear(tp.getFullYear());
                  setViewMonth(tp.getMonth());
                  return;
                }
                commit(t);
              }}
            >
              Today
            </button>
            <span className='date-picker-hint'>Esc to close</span>
          </div>
        </div>
      );
    };

    const renderMonthsView = () => (
      <div>
        <div className='date-picker-head'>
          <button
            type='button'
            className='date-picker-nav-btn'
            aria-label='Previous year'
            onClick={() => setViewYear(y => y - 1)}
          >
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M15 18l-6-6 6-6' />
            </svg>
          </button>
          <button
            type='button'
            className='date-picker-title-btn'
            onClick={() => setMode('days')}
          >
            {viewYear}
          </button>
          <button
            type='button'
            className='date-picker-nav-btn'
            aria-label='Next year'
            onClick={() => setViewYear(y => y + 1)}
          >
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M9 18l6-6-6-6' />
            </svg>
          </button>
        </div>
        <div className='date-picker-months'>
          {MONTH_ABBR.map((label, idx) => {
            const lastDay = daysInMonth(viewYear, idx);
            const wholeMonthOut =
              isOutOfRange(viewYear, idx, 1, min, max) &&
              isOutOfRange(viewYear, idx, lastDay, min, max);
            const isSelected =
              parsedValue &&
              DateUtils.parseDate(parsedValue).getFullYear() === viewYear &&
              DateUtils.parseDate(parsedValue).getMonth() === idx;
            return (
              <button
                key={label}
                type='button'
                className={`date-picker-month${isSelected ? ' is-selected' : ''}`}
                disabled={wholeMonthOut}
                onClick={() => {
                  setViewMonth(idx);
                  setMode('days');
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className='date-picker-field' ref={fieldRef}>
        <button
          type='button'
          id={id}
          ref={triggerRef}
          className={`date-picker-trigger${open ? ' is-open' : ''} ${className || ''}`}
          disabled={disabled}
          aria-haspopup='dialog'
          aria-expanded={open}
          onClick={() => (open ? close() : openPicker())}
        >
          {parsedValue ? (
            <span>{DateUtils.formatShortDate(parsedValue)}</span>
          ) : (
            <span className='placeholder'>{placeholder}</span>
          )}
          <span className='cal-icon'>
            <svg
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <rect x='3' y='5' width='18' height='16' rx='3' />
              <path d='M8 3v4M16 3v4M3 10h18' />
            </svg>
          </span>
        </button>
        {/* The popover stays mounted (for the open/close transition) but
            is fully removed from tab order and the accessibility tree
            while closed via `inert` - without this, every DatePicker on
            the page would leave 42 invisible, keyboard-reachable day
            buttons behind. */}
        {createPortal(
          <div
            className={`date-picker-pop${open ? ' is-open' : ''}`}
            role='dialog'
            aria-label='Choose a date'
            ref={popRef}
            inert={!open ? 'true' : undefined}
            style={
              popStyle ? { top: popStyle.top, left: popStyle.left } : undefined
            }
          >
            {mode === 'days' ? renderDaysView() : renderMonthsView()}
          </div>,
          document.body,
        )}
      </div>
    );
  },
);

DatePicker.displayName = 'DatePicker';

DatePicker.propTypes = {
  id: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.string,
  max: PropTypes.string,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};

DatePicker.defaultProps = {
  id: undefined,
  value: '',
  min: undefined,
  max: undefined,
  disabled: false,
  placeholder: 'Select a date',
  className: '',
};

export default DatePicker;
