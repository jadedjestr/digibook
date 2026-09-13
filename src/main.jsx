import React from 'react';
import ReactDOM from 'react-dom/client';

/* Fonts are self-hosted, not linked from Google. This app is local-first and
   runs offline behind a service worker: a webfont fetched from a third party
   renders wrong with no network, and sends a request revealing app usage on
   every cold load. Bundled, they are precached with everything else.

   Latin subsets only, and only the weights in use. The unscoped entrypoints
   pull Cyrillic, Greek and Vietnamese too — 31 files and 992KB, which grew
   the service worker precache by 41% for glyphs this app never renders.

   Bricolage is the exception: the variable package ships no latin-only
   entrypoint, so `standard` brings latin, latin-ext and vietnamese. Three
   files, which is not worth hand-rolling an @font-face to avoid. */
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';

import App from './App.jsx';
import {
  applyStoredTint,
  applyStoredAmbient,
  applyStoredAmbientColors,
} from './utils/appearance';
import { requestPersistentStorage } from './utils/persistentStorage';
import './index.css';

// Ask before first paint, but never wait on it — the answer only affects how
// long the browser keeps the data, not whether the app can run.
void requestPersistentStorage();

// Synchronous and before render: the glass tint is a paint-time value, so
// reading it later would show one frame at the default and then re-tint.
applyStoredTint();
applyStoredAmbient();
applyStoredAmbientColors();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
