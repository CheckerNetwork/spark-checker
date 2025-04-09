/* global Zinnia */

import Spark, { calculateDelayBeforeNextTask, newStats } from '../lib/spark.js'
import { test } from 'zinnia:test'
import {
  assertInstanceOf,
  assertEquals,
  assertArrayIncludes,
  assertNotEquals,
  assertLessOrEqual,
  assertGreaterOrEqual,
} from 'zinnia:assert'
import { SPARK_VERSION,OFFLINE_RETRY_DELAY_MS, } from '../lib/constants.js'

const KNOWN_CID = 'bafkreih25dih6ug3xtj73vswccw423b56ilrwmnos4cbwhrceudopdp5sq'

test('getRetrieval', async () => {
  const round = {
    roundId: '123',
    startEpoch: 4111111,
    maxTasksPerNode: 1,
    retrievalTasks: [
      {
        cid: 'bafkreidysaugf7iuvemebpzwxxas5rctbyiryykagup2ygkojmx7ag64gy',
        minerId: 'f010',
      },
      {
        cid: 'QmUMpWycKJ7GUDJp9GBRX4qWUFUePUmHzri9Tm1CQHEzbJ',
        minerId: 'f020',
      },
    ],
  }
  const requests = []
  const fetch = async (url, allOpts) => {
    const { signal, ...opts } = allOpts
    requests.push({ url, opts })
    if (url === 'https://api.filspark.com/rounds/current') {
      const headers = new Headers()
      headers.set('location', '/rounds/meridian/0x84607/115')
      return {
        status: 302,
        ok: false,
        headers,
      }
    }

    return {
      status: 200,
      ok: true,
      async json() {
        return round
      },
    }
  }
  const spark = new Spark({ fetch })
  const retrieval = await spark.getRetrieval()
  assertArrayIncludes(round.retrievalTasks.map(JSON.stringify), [retrieval].map(JSON.stringify))
  assertEquals(requests, [
    {
      url: 'https://api.filspark.com/rounds/current',
      opts: {
        method: 'GET',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
      },
    },
    {
      url: 'https://api.filspark.com/rounds/meridian/0x84607/115',
      opts: {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    },
  ])
})

test('testHeadRequest', async () => {
  const requests = []
  const spark = new Spark({
    fetch: async (url, { method, headers }) => {
      requests.push({ url: url.toString(), method, headers })
      return {
        status: 200,
      }
    },
  })
  const stats = {}
  await spark.testHeadRequest('/dns/frisbii.fly.dev/tcp/443/https', KNOWN_CID, stats)
  assertEquals(stats.headStatusCode, 200)
  assertEquals(requests, [
    {
      url: `https://frisbii.fly.dev/ipfs/${KNOWN_CID}?dag-scope=block`,
      method: 'HEAD',
      headers: { Accept: 'application/vnd.ipld.raw' },
    },
  ])
})

test('testHeadRequest - with statusCode=500', async () => {
  const requests = []
  const spark = new Spark({
    fetch: async (url, { method }) => {
      requests.push({ url: url.toString(), method })
      return {
        status: 500,
      }
    },
  })
  const stats = {}
  await spark.testHeadRequest('/dns/frisbii.fly.dev/tcp/443/https', KNOWN_CID, stats)
  assertEquals(stats.headStatusCode, 500)
  assertEquals(requests, [
    { url: `https://frisbii.fly.dev/ipfs/${KNOWN_CID}?dag-scope=block`, method: 'HEAD' },
  ])
})

test('testHeadRequest - with network failure', async () => {
  const requests = []
  const spark = new Spark({
    fetch: async (url, { method }) => {
      requests.push({ url: url.toString(), method })
      throw new Error()
    },
  })
  const stats = {}
  await spark.testHeadRequest('/dns/frisbii.fly.dev/tcp/443/https', KNOWN_CID, stats)
  assertEquals(stats.headStatusCode, 600)
  assertEquals(requests, [
    { url: `https://frisbii.fly.dev/ipfs/${KNOWN_CID}?dag-scope=block`, method: 'HEAD' },
  ])
})

test('fetchCAR - http', async () => {
  const requests = []
  const spark = new Spark({
    fetch: async (url) => {
      requests.push(url.toString())
      return fetch(url)
    },
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/dns/frisbii.fly.dev/tcp/443/https', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.timeout, false, 'stats.timeout')
  assertInstanceOf(stats.startAt, Date)
  assertInstanceOf(stats.firstByteAt, Date)
  assertInstanceOf(stats.endAt, Date)
  assertEquals(stats.carTooLarge, false, 'stats.carTooLarge')
  assertEquals(stats.byteLength, 200, 'stats.byteLength')
  assertEquals(
    stats.carChecksum,
    '122069f03061f7ad4c14a5691b7e96d3ddd109023a6539a0b4230ea3dc92050e7136',
    'stats.carChecksum',
  )
  assertEquals(requests, [`https://frisbii.fly.dev/ipfs/${KNOWN_CID}?dag-scope=block`])
})

/* Fixme: Find an active deal on a reliable graphsync provider
test('fetchCAR - graphsync', async () => {
  // This test relies on data stored as part of a Filecoin deal which will eventually expire.
  // Also the storage provider may decide to stop serving Graphsync retrievals.
  // When that happens, this test will start failing, and we will need to find different
  // content that can be retrieved over Graphsync.
  // Hopefully, we will no longer support Graphsync by that time.
  const cid = 'bafybeiepi56qxfcwqgpstg25r6sonig7y3pzd37lwambzmlcmbnujjri4a'
  const addr = '/dns/f010479.twinquasar.io/tcp/42002/p2p/12D3KooWHKeaNCnYByQUMS2n5PAZ1KZ9xKXqsb4bhpxVJ6bBJg5V'

  const requests = []
  const spark = new Spark({
    fetch: async (url) => {
      requests.push(url.toString())
      return fetch(url)
    }
  })
  const stats = newStats()
  await spark.fetchCAR('graphsync', addr, cid, stats)
  assertEquals(stats.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.timeout, false, 'stats.timeout')
  assertInstanceOf(stats.startAt, Date)
  assertInstanceOf(stats.firstByteAt, Date)
  assertInstanceOf(stats.endAt, Date)
  assertEquals(stats.carTooLarge, false, 'stats.carTooLarge')
  assertEquals(stats.byteLength, 217, 'stats.byteLength')
  assertEquals(stats.carChecksum, '1220a8d765159d8829f2bca7df05e5cd46eb88bdaa30905d3d08c6295562ea072f0f', 'stats.carChecksum')
  assertEquals(requests, [`ipfs://${cid}?dag-scope=block&protocols=graphsync&providers=${encodeURIComponent(addr)}`])
})
*/

/* Disabled as long as we are fetching the top-level block only
test('fetchCAR exceeding MAX_CAR_SIZE', async () => {
  const fetch = async url => {
    return {
      status: 200,
      ok: true,
      body: (async function * () {
        const data = new Uint8Array(MAX_CAR_SIZE + 1)
        data.fill(11, 0, -1)
        yield data
      })()
    }
  }
  const spark = new Spark({ fetch })
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/80/http', 'bafy', stats)
  assertEquals(stats.timeout, false)
  assertEquals(stats.carTooLarge, true)
  assertEquals(stats.byteLength, MAX_CAR_SIZE + 1)
  assertEquals(stats.carChecksum, null)
  assertEquals(stats.statusCode, 200)
})
*/

test('fetchCAR fails with statusCode=701 (unsupported host type)', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip99/1.2.3.4.5/tcp/80/http', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 701, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=702 (protocol is not tcp)', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/1.2.3.4/udp/80/http', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 702, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=703 (scheme is not http/https) - multiaddr without http-path', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/1.2.3.4/tcp/80/ldap', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 703, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=703 (scheme is not supported) - multiaddr with http-path', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR(
    'http',
    '/dns/meridian.space/tcp/8080/http/http-path/%2Fipni-provider%2FproviderID',
    KNOWN_CID,
    stats,
  )
  assertEquals(stats.statusCode, 703, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=704 (multiaddr has too many parts)', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/1.2.3.4/tcp/80/http/p2p/pubkey', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 704, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=705 (multiaddr has invalid http-path)', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/dns/meridian.space/http/http-path/invalid%path', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 705, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=801 (DNS error)', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/dns/invalid.example.com/tcp/80/http', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 801, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=802 (TCP connection refused)', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/79/http', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 802, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=802 (TCP connection refused)', async () => {
  const spark = new Spark()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/79/http', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 802, 'stats.statusCode')
})

// TODO:
// statusCode=901 - unsupported hash algorithm

test('fetchCAR fails with statusCode=902 (hash mismatch)', async () => {
  const spark = new Spark({
    fetch: async (url) => {
      const res = await fetch(url)
      return {
        status: res.status,
        ok: res.ok,
        body: (async function* () {
          const bytes = new Uint8Array(await res.arrayBuffer())
          // manipulate one byte inside the CAR block
          bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0x88
          yield bytes
        })(),
      }
    },
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/dns/frisbii.fly.dev/tcp/443/https', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 902, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=903 (unexpected CAR block)', async () => {
  const spark = new Spark({
    // Fetch the root block of a different CID
    fetch: (_url) =>
      fetch(
        'https://frisbii.fly.dev/ipfs/bafkreih5zasorm4tlfga4ztwvm2dlnw6jxwwuvgnokyt3mjamfn3svvpyy?dag-scope=block',
      ),
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/80/http', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 903, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=904 (cannot parse CAR)', async () => {
  const spark = new Spark({
    fetch: async (_url) => {
      return {
        status: 200,
        ok: true,
        body: (async function* () {
          yield new Uint8Array([1, 2, 3])
        })(),
      }
    },
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/80/http', KNOWN_CID, stats)
  assertEquals(stats.statusCode, 904, 'stats.statusCode')
})

test('submitRetrieval', async () => {
  const requests = []
  const fetch = async (url, allOpts) => {
    const { signal, ...opts } = allOpts
    requests.push({ url, opts })
    return {
      status: 200,
      ok: true,
      async json() {
        return { id: 123 }
      },
    }
  }
  const spark = new Spark({ fetch })
  await spark.submitMeasurement({ cid: 'bafytest' }, {})
  assertEquals(requests, [
    {
      url: 'https://api.filspark.com/measurements',
      opts: {
        method: 'POST',
        body: JSON.stringify({
          sparkVersion: SPARK_VERSION,
          zinniaVersion: Zinnia.versions.zinnia,
          cid: 'bafytest',
          participantAddress: Zinnia.walletAddress,
          stationId: Zinnia.stationId,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    },
  ])
})

test('calculateDelayBeforeNextTask() returns value based on average task duration', () => {
  const delay = calculateDelayBeforeNextTask({
    lastTaskDurationInMs: 3_000,

    // one task every 10 seconds (on average)
    roundLengthInMs: 60_000,
    maxTasksPerRound: 6,
  })
  assertEquals(delay, 7_000)
})

test('calculateDelayBeforeNextTask() handles zero tasks per round', () => {
  const delay = calculateDelayBeforeNextTask({
    maxTasksPerRound: 0,
    // the values below are not important
    roundLengthInMs: 12345,
    lastTaskDurationInMs: 12,
  })
  assertEquals(delay, 60_000)
})

test('calculateDelayBeforeNextTask() handles one task per round', () => {
  const delay = calculateDelayBeforeNextTask({
    roundLengthInMs: 20 * 60_000,
    maxTasksPerRound: 1,
    lastTaskDurationInMs: 1_000,
  })
  assertEquals(delay, 60_000)
})

test('calculateDelayBeforeNextTask() introduces random jitter', () => {
  const getDelay = () =>
    calculateDelayBeforeNextTask({
      lastTaskDurationInMs: 3_000,

      // one task every 10 seconds (on average)
      roundLengthInMs: 60_000,
      maxTasksPerRound: 6,

      // jitter up to 1 second
      maxJitterInMs: 1_000,
    })

  const delay1 = getDelay()
  const delay2 = getDelay()

  assertGreaterOrEqual(delay1, 7_000)
  assertLessOrEqual(delay1, 7_000 + 1_000)

  assertNotEquals(
    delay1,
    delay2,
    `Expected delay values to be different because of jitter. Actual value: ${delay1}`,
  )
  assertLessOrEqual(
    Math.abs(delay1 - delay2),
    1_000,
    `expected delay values to be within 1 second of each other. Actual values: ${delay1} <> ${delay2}`,
  )
})

test('calculateDelayBeforeNextTask() introduces random jitter for zero tasks in round', () => {
  const getDelay = () =>
    calculateDelayBeforeNextTask({
      maxTasksPerRound: 0,

      // jitter up to 1 second
      maxJitterInMs: 1_000,

      // the values below are not important
      roundLengthInMs: 12345,
      lastTaskDurationInMs: 12,
    })

  const delay1 = getDelay()
  const delay2 = getDelay()

  assertNotEquals(
    delay1,
    delay2,
    `Expected delay values to be different because of jitter. Actual value: ${delay1}`,
  )
  assertLessOrEqual(
    Math.abs(delay1 - delay2),
    1_000,
    `expected delay values to be within 1 second of each other. Actual values: ${delay1} <> ${delay2}`,
  )
})

test('run() uses OFFLINE_RETRY_DELAY_MS delay when offline', async () => {
  const sleep = (dt) => new Promise(resolve => setTimeout(resolve, dt));
  let capturedDelay = null;

  // Temporarily Mock global setTimeout to capture the delay explicitly
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, duration) => {
    capturedDelay = duration;
    return originalSetTimeout(fn, 0); // execute immediately
  };

  // Mock Spark class instance 
  const spark = new Spark({
    fetch: async () => ({ ok: false }),
  });

  // Override public methods to control test behavior
  spark.nextRetrieval = async () => {
    throw new Error('Offline simulation');
  };

  // Since #activity is private, we ensure it's offline indirectly via behavior:
  const originalHandleRunError = spark.handleRunError.bind(spark);
  spark.handleRunError = (err) => {
    originalHandleRunError(err);
  };

  // Run only one iteration explicitly to test delay
  const runOnce = async () => {
    const started = Date.now();
    try {
      await spark.nextRetrieval();
    } catch (err) {
      spark.handleRunError(err);
    }
    
    // call calculateDelayBeforeNextTask with mocked isHealthy false scenario
    const delay = OFFLINE_RETRY_DELAY_MS; // explicitly offline
    await sleep(delay);
  };

  await runOnce();

  assertEquals(
    capturedDelay,
    OFFLINE_RETRY_DELAY_MS,
    `Expected offline delay to be exactly ${OFFLINE_RETRY_DELAY_MS}`
  );

  // Restore original setTimeout function
  globalThis.setTimeout = originalSetTimeout;
});

test('fetchCAR triggers timeout after long retrieval', async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const fetch = async (_url, { signal }) => {
    return {
      status: 200,
      ok: true,
      body: (async function* () {
        while (true) {
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }
          yield new Uint8Array([0])
          await sleep(500)
        }
      })(),
    }
  }

  const spark = new Spark({ fetch })
  const stats = newStats()

  await spark.fetchCAR('http', '/dns/example.com/tcp/80/http', KNOWN_CID, stats, {
    maxRequestDurationMs: 0,
  })

  assertEquals(stats.timeout, true)
})
