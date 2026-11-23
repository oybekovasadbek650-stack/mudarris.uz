import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { USE_MOCK } from './api'
import { MOCK_DB_KEY } from './api/mock'
import { initPwa } from './lib/pwa'

// Telefonga o'rnatiladigan ilova (service worker + o'rnatish hodisasi)
initPwa()

const queryClient = new QueryClient({
  defaultOptions: {
    // Asosiy yangilanish — jonli signal (lib/live.ts); refetchInterval — signal ulanmasa zaxira
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5_000, refetchInterval: 30_000 },
  },
})

// Demo rejim: boshqa oynada ma'lumot o'zgarsa — shu oynadagi sahifa ham darhol yangilanadi
if (USE_MOCK) {
  window.addEventListener('storage', (e) => {
    if (e.key === MOCK_DB_KEY) queryClient.invalidateQueries()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
