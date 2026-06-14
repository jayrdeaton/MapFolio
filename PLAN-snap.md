# Snap Features for Route Waypoints

Parked for later. The drag itself must be verified working cleanly before any snap logic is added.

## What was removed

- **Route-to-route snap** (`findSnapOnRoute`, `nearestPointOnSegment`): waypoint snaps to the nearest segment of another route within 20px; hysteresis detaches at 35px.
- **Angle snap** (`applyAngleSnap`): shift-held snap to 15° increments from the adjacent waypoint.

## Why it broke drag

The snap code ran inside `onPointerMove` and mutated `dragState.value.pixel` to a computed position rather than the raw pointer position. Before the snap was added, drag was working with the document-level capture-phase handlers. Adding the route snap iterated over `positions.value` on every move event, which introduced subtle reactivity side-effects and made it very hard to tell whether events were firing vs. logic was wrong.

**Separate concern discovered during debugging**: the SVG was sized `width: 0; height: 0; overflow: visible`. Safari (and possibly other browsers) do not deliver pointer events to SVG child elements that live in the *overflow* area of a zero-size SVG. This was fixed by making the SVG `4000×4000` with `viewBox="-1000 -1000 4000 4000"`, which keeps the layer-point coordinate system aligned while ensuring all visible waypoints fall within the SVG's actual bounding box.

## How to re-add snap cleanly

1. **Verify bare drag works first** — no snap, no angle logic. Just `dragState.value.pixel = pixel`.

2. **Add angle snap** (simpler, self-contained):
   ```ts
   // In onPointerMove, after setting hasMoved:
   dragState.value.pixel = e.shiftKey
     ? applyAngleSnap(pixel, dragState.value.routeId, dragState.value.pointIndex)
     : pixel
   ```
   `applyAngleSnap` uses only `props.routes` and `props.map` — no position iteration.

3. **Add route-to-route snap** (more complex):
   - Constants: `SNAP_ROUTE_PX = 20`, `DETACH_ROUTE_PX = 35`
   - Track `snappedToRoute: boolean` in `dragState`
   - `findSnapOnRoute(pixel, ownRouteId)` iterates `positions.value` for other routes
   - Hysteresis: use DETACH threshold once snapped, SNAP threshold when free
   - **Key**: skip own route by `routeId`, skip hidden routes
   - **Key**: linked-pin waypoints (`pinId` set) skip snap entirely — they follow the pin

4. **Test edge cases**:
   - Single route (no other routes to snap to → free movement always)
   - Waypoint starting position near another route's line → should NOT auto-snap on drag start (threshold check is against current pointer, not initial position)
   - Zoom then drag → positions recomputed on `zoomend`, snap geometry correct
