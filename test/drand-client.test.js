import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { getRandomnessForSparkRound } from '../lib/drand-client.js'

test('getRandomnessForSparkRound', async () => {
  const randomness = await getRandomnessForSparkRound(4111111)
  assertEquals(
    randomness,
    'fc90e50dcdf20886b56c038b30fa921a5e57c532ea448dadcc209e44eec0445e',
  )
})
