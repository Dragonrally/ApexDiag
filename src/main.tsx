import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ApexDiagnostics from './ApexDiagnostics.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApexDiagnostics />
  </StrictMode>
);
