import type { ReactNode } from 'react'

export interface AppState {
  count: number
}

export interface ButtonProps {
  onClick: () => void
  children: ReactNode
}

export type Theme = 'light' | 'dark'

export interface UserPreferences {
  theme: Theme
  autoSave: boolean
}
