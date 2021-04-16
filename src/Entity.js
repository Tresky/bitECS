import { $componentMap } from './Component.js'
import { $queries, queryRemoveEntity } from './Query.js'
import { $size } from './World.js'

export const $entityMasks = Symbol('entityMasks')
export const $entityEnabled = Symbol('entityEnabled')
export const $deferredEntityRemovals = Symbol('deferredEntityRemovals')
export const $removedEntities = Symbol('removedEntities')

// need a global EID cursor which all worlds and all components know about
// so that world entities can posess entire rows spanning all component tables
let globalEntityCursor = 0

export const getEntityCursor = () => globalEntityCursor

export const incrementEntityCursor = () => globalEntityCursor++

export const addEntity = (world) => {
  const removed = world[$removedEntities]
  const size = world[$size]
  const enabled = world[$entityEnabled]

  if (globalEntityCursor >= size - size / 5) { // if 80% full

    const amount = Math.ceil((size/2) / 4) * 4 // grow by half the original size rounded up to a multiple of 4

    // grow data stores
    world[$componentMap].forEach(component => {
      component.manager._grow(amount)
    })
    world[$size] += amount

    // TODO: grow metadata on world mappings for world's internal queries/components
  }

  const eid = removed.length > 0 ? removed.pop() : globalEntityCursor
  enabled[eid] = 1
  globalEntityCursor++
  return eid
}

export const removeEntity = (world, eid) => world[$deferredEntityRemovals].push(eid)

export const commitEntityRemovals = (world) => {
  const deferred = world[$deferredEntityRemovals]
  const queries = world[$queries]
  const removed = world[$removedEntities]
  const enabled = world[$entityEnabled]

  for (let i = 0; i < deferred.length; i++) {
    const eid = deferred[i]
    // Check if entity is already removed
    if (enabled[eid] === 0) continue

    // Remove entity from all queries
    // TODO: archetype graph
    queries.forEach(query => {
      queryRemoveEntity(world, query, eid)
    })

    // Free the entity
    removed.push(eid)
    enabled[eid] = 0

    // Clear component bitmasks
    for (let i = 0; i < world[$entityMasks].length; i++) world[$entityMasks][i][eid] = 0
    
  }

  deferred.length = 0
}