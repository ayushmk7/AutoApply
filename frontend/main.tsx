import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ApiSessionProvider } from './app/context/ApiSessionContext';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiSessionProvider>
      <App />
    </ApiSessionProvider>
  </StrictMode>,
);
