import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // Periodically check for SW updates every 30 minutes
      setInterval(() => {
        registration.update().catch(() => {});
      }, 30 * 60 * 1000);
    }
  },
});

createRoot(document.getElementById('root')!).render(<App />);
