import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { USE_MOCK } from './api'
import { MOCK_DB_KEY } from './api/mock'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 10_000 },
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
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
