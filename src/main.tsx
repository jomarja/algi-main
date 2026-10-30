import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HttpBankApi } from './api/bank.ts';
import { takeBankConsentReturn } from './api/bankConsent.ts';
import { App } from './App.tsx';
import { AppStateProvider, createAppStore } from './state/AppStateProvider.tsx';
import './index.css';

// Runs before the router reads the URL: TBC's consent page sends users back to /?bank=connected|error.
const bankReturn = takeBankConsentReturn();
const store = createAppStore(new HttpBankApi());
// The bank connection lives on the server session, so check it on every start, including the return from TBC.
void store.loadBank();

const container = document.getElementById('root');
if (!container) throw new Error('index.html has no #root element');

createRoot(container).render(
  <StrictMode>
    <AppStateProvider store={store}>
      <App bankReturn={bankReturn} />
    </AppStateProvider>
  </StrictMode>,
);
