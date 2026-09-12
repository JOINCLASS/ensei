'use client'

import { useSyncExternalStore } from 'react'

let message: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

/** 参照HTMLと同じ 1800ms で消える */
export function toast(msg: string) {
  message = msg
  emit()
  clearTimeout(timer)
  timer = setTimeout(() => {
    message = null
    emit()
  }, 1800)
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => message,
    () => null,
  )
}
