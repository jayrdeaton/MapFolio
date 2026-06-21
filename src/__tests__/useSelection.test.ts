import { describe, expect, it } from 'vitest'

import { useSelection } from '@/composables/useSelection'

function setup() {
  return useSelection()
}

describe('useSelection', () => {
  describe('initial state', () => {
    it('starts with nothing selected', () => {
      const { selectedPinIds, selectedRouteIds, selectedCaptionIds, selectedWaypointKey, hasSelection } = setup()
      expect(selectedPinIds.value.size).toBe(0)
      expect(selectedRouteIds.value.size).toBe(0)
      expect(selectedCaptionIds.value.size).toBe(0)
      expect(selectedWaypointKey.value).toBeNull()
      expect(hasSelection.value).toBe(false)
    })
  })

  describe('selectPin', () => {
    it('exclusive: selects only the pin and clears routes and captions', () => {
      const s = setup()
      s.selectRoute(10, false)
      s.selectCaption(20, false)
      s.selectPin(1, false)
      expect(s.selectedPinIds.value).toEqual(new Set([1]))
      expect(s.selectedRouteIds.value.size).toBe(0)
      expect(s.selectedCaptionIds.value.size).toBe(0)
    })

    it('exclusive: replaces a prior pin selection', () => {
      const s = setup()
      s.selectPin(1, false)
      s.selectPin(2, false)
      expect(s.selectedPinIds.value).toEqual(new Set([2]))
    })

    it('additive: adds a second pin without clearing the first', () => {
      const s = setup()
      s.selectPin(1, false)
      s.selectPin(2, true)
      expect(s.selectedPinIds.value).toEqual(new Set([1, 2]))
    })

    it('additive: toggles off a pin that is already selected', () => {
      const s = setup()
      s.selectPin(1, false)
      s.selectPin(1, true)
      expect(s.selectedPinIds.value.size).toBe(0)
    })

    it('clears the waypoint key', () => {
      const s = setup()
      s.selectWaypoint(5, 0)
      s.selectPin(1, false)
      expect(s.selectedWaypointKey.value).toBeNull()
    })

    it('sets hasSelection to true', () => {
      const s = setup()
      s.selectPin(1, false)
      expect(s.hasSelection.value).toBe(true)
    })
  })

  describe('selectRoute', () => {
    it('exclusive: selects only the route and clears pins and captions', () => {
      const s = setup()
      s.selectPin(1, false)
      s.selectCaption(20, false)
      s.selectRoute(10, false)
      expect(s.selectedRouteIds.value).toEqual(new Set([10]))
      expect(s.selectedPinIds.value.size).toBe(0)
      expect(s.selectedCaptionIds.value.size).toBe(0)
    })

    it('additive: adds route without clearing existing routes', () => {
      const s = setup()
      s.selectRoute(10, false)
      s.selectRoute(11, true)
      expect(s.selectedRouteIds.value).toEqual(new Set([10, 11]))
    })

    it('additive: toggles off an already-selected route', () => {
      const s = setup()
      s.selectRoute(10, false)
      s.selectRoute(10, true)
      expect(s.selectedRouteIds.value.size).toBe(0)
    })

    it('clears the waypoint key', () => {
      const s = setup()
      s.selectWaypoint(5, 0)
      s.selectRoute(10, false)
      expect(s.selectedWaypointKey.value).toBeNull()
    })
  })

  describe('selectCaption', () => {
    it('exclusive: selects only the caption and clears pins and routes', () => {
      const s = setup()
      s.selectPin(1, false)
      s.selectRoute(10, false)
      s.selectCaption(20, false)
      expect(s.selectedCaptionIds.value).toEqual(new Set([20]))
      expect(s.selectedPinIds.value.size).toBe(0)
      expect(s.selectedRouteIds.value.size).toBe(0)
    })

    it('additive: toggles a caption in and out', () => {
      const s = setup()
      s.selectCaption(20, false)
      s.selectCaption(21, true)
      expect(s.selectedCaptionIds.value).toEqual(new Set([20, 21]))
      s.selectCaption(20, true)
      expect(s.selectedCaptionIds.value).toEqual(new Set([21]))
    })

    it('clears the waypoint key', () => {
      const s = setup()
      s.selectWaypoint(5, 0)
      s.selectCaption(20, false)
      expect(s.selectedWaypointKey.value).toBeNull()
    })
  })

  describe('selectWaypoint', () => {
    it('sets the waypoint key and clears all id sets', () => {
      const s = setup()
      s.selectPin(1, false)
      s.selectRoute(10, false)
      s.selectCaption(20, false)
      s.selectWaypoint(5, 2)
      expect(s.selectedWaypointKey.value).toEqual({ routeId: 5, pointIndex: 2 })
      expect(s.selectedPinIds.value.size).toBe(0)
      expect(s.selectedRouteIds.value.size).toBe(0)
      expect(s.selectedCaptionIds.value.size).toBe(0)
    })

    it('sets hasSelection to true', () => {
      const s = setup()
      s.selectWaypoint(5, 0)
      expect(s.hasSelection.value).toBe(true)
    })

    it('replaces a prior waypoint selection', () => {
      const s = setup()
      s.selectWaypoint(5, 0)
      s.selectWaypoint(7, 3)
      expect(s.selectedWaypointKey.value).toEqual({ routeId: 7, pointIndex: 3 })
    })
  })

  describe('clearSelection', () => {
    it('resets everything', () => {
      const s = setup()
      s.selectPin(1, false)
      s.selectRoute(10, true)
      s.selectCaption(20, true)
      s.selectWaypoint(5, 0)
      s.clearSelection()
      expect(s.selectedPinIds.value.size).toBe(0)
      expect(s.selectedRouteIds.value.size).toBe(0)
      expect(s.selectedCaptionIds.value.size).toBe(0)
      expect(s.selectedWaypointKey.value).toBeNull()
      expect(s.hasSelection.value).toBe(false)
    })
  })

  describe('hasSelection', () => {
    it('is false when nothing is selected', () => {
      expect(setup().hasSelection.value).toBe(false)
    })

    it('is true with a single pin', () => {
      const s = setup()
      s.selectPin(1, false)
      expect(s.hasSelection.value).toBe(true)
    })

    it('is true with only a waypoint selected', () => {
      const s = setup()
      s.selectWaypoint(1, 0)
      expect(s.hasSelection.value).toBe(true)
    })

    it('becomes false after clearSelection', () => {
      const s = setup()
      s.selectPin(1, false)
      s.clearSelection()
      expect(s.hasSelection.value).toBe(false)
    })
  })
})
