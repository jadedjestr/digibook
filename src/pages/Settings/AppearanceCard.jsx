import { useState } from 'react';

import {
  getStoredTint,
  setStoredTint,
  getStoredAmbient,
  setStoredAmbient,
  getStoredAmbientColors,
  setStoredAmbientColors,
  matchPreset,
  AMBIENT_PRESETS,
  DEFAULT_TINT,
} from '../../utils/appearance';

const STOPS = [
  { key: 'top', label: 'Top' },
  { key: 'middle', label: 'Middle' },
  { key: 'bottom', label: 'Bottom' },
];

/**
 * Glass transparency and the ambient ground behind it, mirroring the control
 * iOS 27 added to Settings.
 *
 * Each slider writes a single CSS variable that the whole app reads, so
 * dragging re-tints everything live — including this card. That is the point:
 * the setting is previewed on the surface you are adjusting.
 */
const AppearanceCard = () => {
  const [tint, setTint] = useState(() => getStoredTint());
  const [ambient, setAmbient] = useState(() => getStoredAmbient());
  const [colors, setColors] = useState(() => getStoredAmbientColors());

  const activePreset = matchPreset(colors);

  const applyPreset = preset =>
    setColors(setStoredAmbientColors(preset.colors));

  const handleStopChange = (key, value) =>
    setColors(setStoredAmbientColors({ ...colors, [key]: value }));

  const handleChange = event => {
    // Apply and persist on every frame of the drag. The write is a single
    // short localStorage key, and seeing the result while dragging is the
    // only way to judge it.
    setTint(setStoredTint(Number(event.target.value) / 100));
  };

  const handleAmbientChange = event => {
    setAmbient(setStoredAmbient(Number(event.target.value) / 100));
  };

  const percent = Math.round(tint * 100);
  const ambientPercent = Math.round(ambient * 100);

  return (
    <div className='space-y-4'>
      <div>
        <div className='flex items-baseline justify-between gap-4 mb-1'>
          <label
            htmlFor='glass-tint'
            className='text-sm font-medium text-white'
          >
            Glass transparency
          </label>
          <span className='text-sm text-blue-300 font-mono'>
            {percent}% tinted
          </span>
        </div>

        <p className='text-xs text-white/50 mb-3'>
          How opaque panels are over the background. Lower is clearer and shows
          more through; higher raises contrast and makes text easier to read.
        </p>

        <input
          id='glass-tint'
          type='range'
          min='0'
          max='100'
          value={percent}
          onChange={handleChange}
          className='w-full accent-blue-500 cursor-pointer'
          aria-describedby='glass-tint-scale'
        />

        <div
          id='glass-tint-scale'
          className='flex justify-between text-xs text-white/40 mt-1'
        >
          <span>Ultra clear</span>
          <span>Fully tinted</span>
        </div>
      </div>

      <div className='pt-2 border-t border-white/10'>
        <div className='flex items-baseline justify-between gap-4 mb-1'>
          <label
            htmlFor='ambient-strength'
            className='text-sm font-medium text-white'
          >
            Ambient colour
          </label>
          <span className='text-sm text-blue-300 font-mono'>
            {ambientPercent}%
          </span>
        </div>

        <p className='text-xs text-white/50 mb-3'>
          The colour behind the glass. It is what makes panels read as glass
          rather than flat cards — turn it down if you find it distracting under
          text.
        </p>

        <input
          id='ambient-strength'
          type='range'
          min='0'
          max='100'
          value={ambientPercent}
          onChange={handleAmbientChange}
          className='w-full accent-blue-500 cursor-pointer'
          aria-describedby='ambient-strength-scale'
        />

        <div
          id='ambient-strength-scale'
          className='flex justify-between text-xs text-white/40 mt-1'
        >
          <span>Off</span>
          <span>Full</span>
        </div>
      </div>

      <div className='pt-2 border-t border-white/10'>
        <span className='block text-sm font-medium text-white mb-1'>
          Palette
        </span>
        <p className='text-xs text-white/50 mb-3'>
          Three colours drive the field behind the glass. Pick a preset, or set
          each one yourself.
        </p>

        <div
          className='grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4'
          role='group'
          aria-label='Ambient palette presets'
        >
          {AMBIENT_PRESETS.map(preset => (
            <button
              key={preset.id}
              type='button'
              onClick={() => applyPreset(preset)}
              aria-pressed={activePreset === preset.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                activePreset === preset.id
                  ? 'border-blue-500 bg-blue-500/15'
                  : 'border-white/10 hover:border-white/25 hover:bg-white/5'
              }`}
            >
              <span
                aria-hidden='true'
                className='w-6 h-6 rounded-full shrink-0 border border-white/20'
                style={{
                  backgroundImage: `linear-gradient(140deg, ${preset.colors.top}, ${preset.colors.middle}, ${preset.colors.bottom})`,
                }}
              />
              <span className='text-xs text-white/85 truncate'>
                {preset.name}
              </span>
            </button>
          ))}
        </div>

        <div className='grid grid-cols-3 gap-3'>
          {STOPS.map(stop => (
            <div key={stop.key}>
              <label
                htmlFor={`ambient-${stop.key}`}
                className='block text-xs text-white/60 mb-1'
              >
                {stop.label}
              </label>
              <input
                id={`ambient-${stop.key}`}
                type='color'
                value={colors[stop.key]}
                onChange={e => handleStopChange(stop.key, e.target.value)}
                className='w-full h-9 rounded-lg bg-transparent border border-white/15 cursor-pointer'
              />
              <span className='block mt-1 text-[10px] text-white/40 font-mono'>
                {colors[stop.key]}
              </span>
            </div>
          ))}
        </div>

        <p className='text-xs text-white/40 mt-3'>
          {activePreset
            ? 'Matches a preset.'
            : 'Custom palette. It travels with your exported backup.'}
        </p>
      </div>

      {percent !== Math.round(DEFAULT_TINT * 100) && (
        <button
          type='button'
          onClick={() => setTint(setStoredTint(DEFAULT_TINT))}
          className='text-xs text-blue-300 hover:text-blue-200 underline'
        >
          Reset to default
        </button>
      )}
    </div>
  );
};

export default AppearanceCard;
