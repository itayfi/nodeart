import { useEffect, useState } from 'react'
import { bind, setEnabled, setVolume } from 'cuelume'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'

const storageKey = 'nodeart-sound-enabled'
export function SoundToggle() {
  const [enabled, updateEnabled] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'false' } catch { return true }
  })
  useEffect(() => {
    setVolume(0.25)
    bind()
  }, [])
  useEffect(() => {
    setEnabled(enabled)
    try { localStorage.setItem(storageKey, String(enabled)) } catch { /* Storage may be unavailable. */ }
  }, [enabled])
  return <Button variant="secondary" size="sm" aria-label="Interaction sounds" aria-pressed={enabled}
    data-cuelume-tap="toggle" onClick={() => {
      // Apply immediately so turning sound off is silent and enabling gives feedback.
      setEnabled(!enabled)
      updateEnabled(!enabled)
    }}>{enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}Sound {enabled ? 'on' : 'off'}</Button>
}
