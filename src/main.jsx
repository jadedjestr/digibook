import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import { requestPersistentStorage } from './utils/persistentStorage';
import './index.css';

// Ask before first paint, but never wait on it — the answer only affects how
// long the browser keeps the data, not whether the app can run.
void requestPersistentStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
