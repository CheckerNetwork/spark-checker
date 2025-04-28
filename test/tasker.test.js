/* global Zinnia */

import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { getStationKey, getTaskKey, pickTasks } from '../lib/tasker.js'

const RANDOMNESS =
  'fc90e50dcdf20886b56c038b30fa921a5e57c532ea448dadcc209e44eec0445e'

test('getTaskKey', async () => {
  const key = await getTaskKey({ cid: 'bafyone', minerId: 'f0123' }, RANDOMNESS)
  assertEquals(
    key,
    19408172415633384483144889917969030396168570904487614072975030553911283422991n,
  )
})

test('getStationKey', async () => {
  const key = await getStationKey(Zinnia.stationId)
  assertEquals(
    key,
    15730389902218173522122968096857080019341969656147255283496861606681823756880n,
  )
})

test('pickTasksForNode', async () => {
  const allTasks = [
    { cid: 'bafyone', minerId: 'f010' },
    { cid: 'bafyone', minerId: 'f020' },
    { cid: 'bafyone', minerId: 'f030' },
    { cid: 'bafyone', minerId: 'f040' },

    { cid: 'bafytwo', minerId: 'f010' },
    { cid: 'bafytwo', minerId: 'f020' },
    { cid: 'bafytwo', minerId: 'f030' },
    { cid: 'bafytwo', minerId: 'f040' },
  ]

  const selectedTasks = await pickTasks({
    tasks: allTasks,
    stationId: 'some-station-id',
    randomness: RANDOMNESS,
    maxTasksPerRound: 3,
  })

  assertEquals(selectedTasks, [
    { cid: 'bafyone', minerId: 'f020' },
    { cid: 'bafyone', minerId: 'f010' },
    { cid: 'bafytwo', minerId: 'f020' },
  ])
})
