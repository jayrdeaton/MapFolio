export interface Notification {
  message: string
  type: 'success' | 'error' | 'info'
}

export function useNotification() {
  const notification = ref<Notification | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function showNotification(message: string, type: Notification['type'] = 'success') {
    if (timer) clearTimeout(timer)
    notification.value = { message, type }
    timer = setTimeout(() => {
      notification.value = null
    }, 3000)
  }

  function cleanupNotification() {
    if (timer) clearTimeout(timer)
  }

  return { notification, showNotification, cleanupNotification }
}
