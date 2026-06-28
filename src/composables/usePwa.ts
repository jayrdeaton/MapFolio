export const usePwa = () => {
  const isPwa = ref(false)
  const isMounted = ref(false)

  onMounted(() => {
    isPwa.value = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    isMounted.value = true
  })

  return { isPwa, isMounted }
}
