// Kutilmagan xato bo'lsa butun sahifa oq bo'lib qolmasin — tushunarli xabar va "Qayta yuklash" tugmasi
import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sahifada xato:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app p-6 font-sans text-slate-900">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-xl ring-1 ring-black/5">
          <img src="/logos/mudarris.svg" alt="Mudarris" className="mx-auto h-14 w-14 rounded-2xl" />
          <h1 className="mt-5 text-xl font-extrabold">Kutilmagan xato yuz berdi</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Sahifani qayta yuklang. Xato takrorlansa, quyidagi matnni texnik xodimga yuboring.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-2xl bg-slate-50 p-3 text-left text-xs text-rose-700">{this.state.error.message}</pre>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.assign('/')}
              className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              Bosh sahifa
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-linear-to-r from-brand to-brand-strong px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25"
            >
              Qayta yuklash
            </button>
          </div>
        </div>
      </div>
    )
  }
}
