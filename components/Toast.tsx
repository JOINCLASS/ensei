'use client'

import { useToast } from '@/lib/toast'

export function Toast() {
  const message = useToast()
  return (
    <div className="toast" id="toast" role="status" hidden={!message}>
      {message}
    </div>
  )
}
