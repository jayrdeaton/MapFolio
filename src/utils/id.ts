// Monotonic unique id generator for pins and routes.
//
// Bare Date.now() returns the same value for two items created in the same
// millisecond (rapid pin placement, paste, the cluster-click + map-click
// double-fire). Colliding ids become colliding Vue :key values, which corrupts
// PinMarker's imperative Leaflet lifecycle (orphaned markers, drag falling
// through to the map, unmount crashes). This guarantees strictly increasing,
// unique numbers even within one millisecond.
//
// On reload `last` resets to 0, but the first uid() returns Date.now(), which
// is greater than any previously persisted Date.now()-based id (time only moves
// forward) — so freshly generated ids never collide with stored ones.
let last = 0

export function uid(): number {
  const now = Date.now()
  last = now > last ? now : last + 1
  return last
}
