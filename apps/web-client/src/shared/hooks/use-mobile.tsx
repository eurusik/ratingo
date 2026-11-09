import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribeToViewportChange(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getIsMobileSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getIsMobileServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToViewportChange,
    getIsMobileSnapshot,
    getIsMobileServerSnapshot
  )
}
