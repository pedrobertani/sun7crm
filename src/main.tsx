import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { legacyRouteTarget } from './lib/routing';
import './styles.css';

const legacyRoute = legacyRouteTarget(window.location.href);
if (legacyRoute) window.history.replaceState(window.history.state, '', legacyRoute);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
