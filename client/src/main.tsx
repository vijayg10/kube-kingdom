import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useUiStore } from './store/uiStore';
import { useClusterStore } from './store/clusterStore';
import { sceneRefs } from './render/sceneRefs';

// Dev-only handle for debugging / e2e verification from the console.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__kc = {
    ui: useUiStore,
    cluster: useClusterStore,
    scene: sceneRefs,
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
