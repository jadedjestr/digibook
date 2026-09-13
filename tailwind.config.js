/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ================================================================
           PALETTE REMAP — read this before adding a colour anywhere.

           641 hardcoded colour utilities are spread across 57 component
           files. Rewriting every call site to change the accent would be a
           57-file diff, and a cosmetic 57-file diff is precisely what put
           every modal behind its own backdrop for five months (61db054).

           So the names are redefined instead of the call sites. `blue-*`
           renders ochre, `gray-*`/`slate-*` render the warm neutrals, and
           `amber`/`orange` collapse into the single yellow caution hue.
           Every existing class keeps working, the relative lightness the
           UI already depends on is preserved, and reverting is one file.

           The cost is that a class named `bg-blue-500` paints ochre. Use
           the SEMANTIC names below in anything new — `bg-accent`,
           `text-ink-soft`, `border-rule` — and treat the colour-word
           scales as legacy aliases that exist to keep old markup correct.

           ROLES, which are what actually keep the UI readable:
             ochre  — interactive only. Buttons, active nav, focus.
             green  — succeeded, paid, on track.
             yellow — caution. Every warm alert lives here now.
             red    — error, overdue, destructive.
           Ochre is never a status and yellow is never a control. That
           separation is the whole reason the alert oranges moved: an
           ochre accent sitting beside an orange warning made "you can
           press this" and "this bill is late" the same colour.
           ================================================================ */

        /* Ochre — the accent. Aliased over `blue` so existing markup
           follows. 500 is the base; the ramp keeps blue's lightness
           ordering so `blue-300` text stays lighter than `blue-500` fills. */
        accent: {
          200: '#f7dcc6',
          300: '#f0c09b',
          400: '#e8a778',
          500: '#e0915c',
          600: '#c87540',
          700: '#a35a2e',
          DEFAULT: '#e0915c',
        },
        blue: {
          200: '#f7dcc6',
          300: '#f0c09b',
          400: '#e8a778',
          500: '#e0915c',
          600: '#c87540',
          700: '#a35a2e',
        },

        /* Warm-cool neutrals, carried from the design review page. */
        ink: {
          DEFAULT: '#e9ebef',
          soft: '#a2a9b4',
          faint: '#6e757f',
        },
        surface: {
          base: '#0d0f13',
          raised: '#15181e',
          rule: '#2a2f38',
        },
        rule: '#2a2f38',

        gray: {
          300: '#c6ccd4',
          400: '#a2a9b4',
          500: '#6e757f',
          600: '#4a515b',
          700: '#2a2f38',
          800: '#1f242b',
        },
        slate: {
          50: '#f4f5f7',
          100: '#e9ebef',
          800: '#15181e',
          900: '#0d0f13',
        },

        /* Caution. `amber` and `orange` are folded into yellow so the warm
           alert space is one hue that cannot be mistaken for the accent. */
        yellow: {
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        },
        amber: {
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
        },
        orange: {
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
        },

        glass: {
          50: 'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.15)',
          300: 'rgba(255, 255, 255, 0.2)',
          400: 'rgba(255, 255, 255, 0.25)',
          500: 'rgba(255, 255, 255, 0.3)',
        },
        backdrop: {
          light: 'rgba(255, 255, 255, 0.8)',
          dark: 'rgba(0, 0, 0, 0.8)',
        },
      },

      fontFamily: {
        display: [
          '"Bricolage Grotesque Variable"',
          'Bricolage Grotesque',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      backdropBlur: {
        glass: '14px',
      },
      borderRadius: {
        glass: '24px',
      },
      boxShadow: {
        glass: '0 4px 20px rgba(0, 0, 0, 0.25)',
        'glass-light': '0 4px 20px rgba(255, 255, 255, 0.1)',
      },
      animation: {
        ripple: 'ripple 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(0.9)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
