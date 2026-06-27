export interface Notification {
  message: string
  type: 'success' | 'error' | 'info'
}

export function useNotification() {
  const notification = ref<Notification | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function showNotification(message: string, type: Notification['type'] = 'success', persistent = false) {
    if (timer) clearTimeout(timer)
    notification.value = { message, type }
    if (!persistent) {
      timer = setTimeout(() => {
        notification.value = null
      }, 3000)
    }
  }

  function dismissNotification() {
    if (timer) clearTimeout(timer)
    notification.value = null
  }

  function cleanupNotification() {
    if (timer) clearTimeout(timer)
  }

  return { notification, showNotification, dismissNotification, cleanupNotification }
}
