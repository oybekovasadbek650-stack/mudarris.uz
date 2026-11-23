// Toast konteksti va hook (komponent — components/Toast.tsx)
import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => {})

/** const toast = useToast(); toast("Saqlandi") */
export const useToast = () => useContext(ToastContext)
