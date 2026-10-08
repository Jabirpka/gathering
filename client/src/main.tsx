import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { initTheme } from './lib/theme';

// Apply the saved/default theme before React paints to avoid a flash.
initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'rgb(var(--ink))',
            border: '1px solid var(--card-border)',
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
