import { useEffect, useRef, useState } from 'react'

const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY
const DISMISS_KEY = 'push_prompt_dismissed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  await fetch('/api/v1/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
  })
}

async function doSubscribe(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    await saveSubscription(existing)
    return
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  })
  await saveSubscription(sub)
}

interface UsePushNotificationsResult {
  showBanner: boolean
  requestAndSubscribe: () => Promise<void>
  dismiss: () => void
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => ('Notification' in window ? Notification.permission : 'denied')
  )
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  )
  const subscribed = useRef(false)

  // If already granted, subscribe silently in the background
  useEffect(() => {
    if (permission === 'granted' && !subscribed.current) {
      subscribed.current = true
      doSubscribe().catch(err => console.warn('Push subscribe failed:', err))
    }
  }, [permission])

  async function requestAndSubscribe(): Promise<void> {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      await doSubscribe()
    }
    // Hide the banner regardless of the user's choice
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  function dismiss(): void {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  const showBanner =
    !dismissed &&
    permission === 'default' &&
    'PushManager' in window &&
    'serviceWorker' in navigator

  return { showBanner, requestAndSubscribe, dismiss }
}
