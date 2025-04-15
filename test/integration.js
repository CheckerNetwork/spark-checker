import Spark from '../lib/spark.js'

import { assert, assertEquals } from 'zinnia:assert'
import { test } from 'zinnia:test'

const KNOWN_CID = 'bafkreih25dih6ug3xtj73vswccw423b56ilrwmnos4cbwhrceudopdp5sq'
const OUR_FAKE_MINER_ID = 'f01spark'
const FRISBEE_PEER_ID = '12D3KooWC8gXxg9LoJ9h3hy3jzBkEAxamyHEQJKtRmAuBuvoMzpr'

test('integration', async () => {
  const spark = new Spark()
  const measurementId = await spark.nextRetrieval()
  const res = await fetch(`https://api.filspark.com/measurements/${measurementId}`)
  assert(res.ok)
  const retrieval = await res.json()
  assert(retrieval.indexerResult)
  assert(retrieval.finishedAt)
})

test('retrieval check for our CID', async () => {
  const minersChecked = []
  const getIndexProviderPeerId = async (minerId) => {
    minersChecked.push(minerId)
    return FRISBEE_PEER_ID
  }
  const spark = new Spark({ getIndexProviderPeerId })
  spark.getRetrieval = async () => ({
    retrievalTask: { cid: KNOWN_CID, minerId: OUR_FAKE_MINER_ID },
    randomness: 0,
  })

  const measurementId = await spark.nextRetrieval()
  const res = await fetch(`https://api.filspark.com/measurements/${measurementId}`)
  assert(res.ok)
  const m = await res.json()
  const assertProp = (prop, expectedValue) => assertEquals(m[prop], expectedValue, prop)

  assertEquals(minersChecked, [OUR_FAKE_MINER_ID])

  assertProp('cid', KNOWN_CID)
  assertProp('minerId', OUR_FAKE_MINER_ID)
  assertProp('providerId', FRISBEE_PEER_ID)
  assertProp('indexerResult', 'OK')
  assertProp('providerAddress', '/dns/frisbii.fly.dev/tcp/443/https')
  assertProp('protocol', 'http')
  assertProp('timeout', false)
  assertProp('statusCode', 200)
  // Note: frisbii.fly.io doesn't support HEAD requests yet
  // https://github.com/CheckerNetwork/frisbii-on-fly/issues/3
  assertProp('headStatusCode', 405)
  assertProp('byteLength', 200)
  assertProp('carTooLarge', false)
  // TODO - spark-api does not record this field yet
  // assertProp('carChecksum', '122069f03061f7ad4c14a5691b7e96d3ddd109023a6539a0b4230ea3dc92050e7136')
})

test('can execute manual check for our CID', async () => {
  await import('../manual-check.js')
})
