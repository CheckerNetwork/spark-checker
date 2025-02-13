/* global Zinnia */

import { ActivityState } from './activity-state.js'
import { SPARK_VERSION, MAX_CAR_SIZE, APPROX_ROUND_LENGTH_IN_MS } from './constants.js'
import { queryTheIndex } from './ipni-client.js'
import { assertOkResponse } from './http-assertions.js'
import { getMinerPeerId as defaultGetMinerPeerId } from './miner-info.js'
import { multiaddrToHttpUrl } from './multiaddr.js'
import { Tasker } from './tasker.js'

import {
  CarBlockIterator,
  encodeHex,
  HashMismatchError,
  UnsupportedHashError,
  validateBlock
} from '../vendor/deno-deps.js'

const sleep = dt => new Promise(resolve => setTimeout(resolve, dt))

export default class Spark {
  #fetch
  #getMinerPeerId
  #activity = new ActivityState()
  #tasker

  constructor ({
    fetch = globalThis.fetch,
    getMinerPeerId = defaultGetMinerPeerId
  } = {}) {
    this.#fetch = fetch
    this.#getMinerPeerId = getMinerPeerId
    this.#tasker = new Tasker({
      fetch: this.#fetch,
      activityState: this.#activity
    })
  }

  async getRetrieval () {
    const retrieval = await this.#tasker.next()
    if (retrieval) {
      console.log({ retrieval })
    }
    return retrieval
  }

  async executeRetrievalCheck (retrieval, stats) {
    console.log(`Calling Filecoin JSON-RPC to get PeerId of miner ${retrieval.minerId}`)
    try {
      const peerId = await this.#getMinerPeerId(retrieval.minerId)
      console.log(`Found peer id: ${peerId}`)
      stats.providerId = peerId
    } catch (err) {
      // There are three common error cases:
      //  1. We are offline
      //  2. The JSON RPC provider is down
      //  3. JSON RPC errors like when Miner ID is not a known actor
      // There isn't much we can do in the first two cases. We can notify the user that we are not
      // performing any jobs and wait until the problem is resolved.
      // The third case should not happen unless we made a mistake, so we want to learn about it
      if (err.name === 'FilecoinRpcError') {
        // TODO: report the error to Sentry
        console.error('The error printed below was not expected, please report it on GitHub:')
        console.error('https://github.com/filecoin-station/spark/issues/new')
      }
      // Abort the check, no measurement should be recorded
      throw err
    }

    console.log(`Querying IPNI to find retrieval providers for ${retrieval.cid}`)
    const { indexerResult, provider } = await queryTheIndex(retrieval.cid, stats.providerId)
    stats.indexerResult = indexerResult

    const providerFound = indexerResult === 'OK' || indexerResult === 'HTTP_NOT_ADVERTISED'
    if (!providerFound) return

    stats.protocol = provider.protocol
    stats.providerAddress = provider.address

    await this.fetchCAR(provider.protocol, provider.address, retrieval.cid, stats)
    if (stats.protocol === 'http') {
      await this.testHeadRequest(provider.address, retrieval.cid, stats)
    }
  }

  async fetchCAR (protocol, address, cid, stats) {
    // Abort if no progress was made for 60 seconds
    const controller = new AbortController()
    const { signal } = controller
    let timeout
    const resetTimeout = () => {
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(() => {
        stats.timeout = true
        controller.abort()
      }, 60_000)
    }

    // WebCrypto API does not support streams yet, the hashing function requires entire data
    // to be provided at once. See https://github.com/w3c/webcrypto/issues/73
    const carBuffer = new ArrayBuffer(0, { maxByteLength: MAX_CAR_SIZE })
    const carBytes = new Uint8Array(carBuffer)

    stats.startAt = new Date()

    try {
      const url = getRetrievalUrl(protocol, address, cid)
      console.log(`Fetching: ${url}`)

      resetTimeout()
      const res = await this.#fetch(url, { signal })
      stats.statusCode = res.status

      if (res.ok) {
        resetTimeout()
        for await (const value of res.body) {
          if (stats.firstByteAt === null) {
            stats.firstByteAt = new Date()
          }
          stats.byteLength += value.byteLength

          // We want to limit how large content we are willing to download.
          // 1. To make sure we don't spend too much time (and network bandwidth) on a single task,
          //    so that we can complete more tasks per round
          // 2. Until we have streaming hashes, we need to keep the entire payload in memory, and so
          //    we need to put an upper limit on how much memory we consume.
          if (stats.byteLength > MAX_CAR_SIZE) {
            stats.carTooLarge = true
            break
          }

          const offset = carBuffer.byteLength
          carBuffer.resize(offset + value.byteLength)
          carBytes.set(value, offset)

          resetTimeout()
        }

        if (!stats.carTooLarge) {
          await verifyContent(cid, carBytes)

          const digest = await crypto.subtle.digest('sha-256', carBytes)
          // 12 is the code for sha2-256
          // 20 is the digest length (32 bytes = 256 bits)
          stats.carChecksum = '1220' + encodeHex(digest)
        }
      } else {
        console.error('Retrieval failed with status code %s: %s',
          res.status, (await res.text()).trimEnd())
      }
    } catch (err) {
      console.error(`Failed to fetch ${cid} from ${address} using ${protocol}`)
      console.error(err)
      if (!stats.statusCode || stats.statusCode === 200) {
        stats.statusCode = mapErrorToStatusCode(err)
      }
    } finally {
      clearTimeout(timeout)
    }

    stats.endAt = new Date()
  }

  async testHeadRequest (address, cid, stats) {
    const url = getRetrievalUrl('http', address, cid)
    console.log(`Testing HEAD request: ${url}`)
    try {
      const res = await this.#fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10_000)
      })
      stats.headStatusCode = res.status
    } catch (err) {
      console.error(`Failed to make HEAD request to ${address} for ${cid}`)
      console.error(err)
      stats.headStatusCode = mapErrorToStatusCode(err)
    }
  }

  async submitMeasurement (task, stats) {
    console.log('Submitting measurement...')
    const payload = {
      sparkVersion: SPARK_VERSION,
      zinniaVersion: Zinnia.versions.zinnia,
      ...task,
      ...stats,
      participantAddress: Zinnia.walletAddress,
      stationId: Zinnia.stationId
    }
    console.log('%o', payload)
    const res = await this.#fetch('https://api.filspark.com/measurements', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10_000)
    })
    await assertOkResponse(res, 'Failed to submit measurement')
    const { id } = await res.json()
    console.log('Measurement submitted (id: %s)', id)
    return id
  }

  async nextRetrieval () {
    const retrieval = await this.getRetrieval()
    if (!retrieval) {
      console.log('Completed all tasks for the current round. Waiting for the next round to start.')
      return
    }

    const stats = newStats()

    await this.executeRetrievalCheck(retrieval, stats)

    const measurementId = await this.submitMeasurement(retrieval, { ...stats })
    Zinnia.jobCompleted()
    return measurementId
  }

  async run () {
    while (true) {
      const started = Date.now()
      try {
        await this.nextRetrieval()
        this.#activity.onHealthy()
      } catch (err) {
        this.handleRunError(err)
      }
      const duration = Date.now() - started
      const delay = calculateDelayBeforeNextTask({
        roundLengthInMs: APPROX_ROUND_LENGTH_IN_MS,
        maxTasksPerRound: this.#tasker.maxTasksPerRound,
        lastTaskDurationInMs: duration
      })

      if (delay > 0) {
        console.log(
          'Sleeping for %s seconds before starting the next task...',
          Math.round(delay / 1000)
        )
        await sleep(delay)
        console.log() // add an empty line to visually delimit logs from different tasks
      }
    }
  }

  handleRunError (err) {
    if (err.statusCode === 400 && err.serverMessage === 'OUTDATED CLIENT') {
      this.#activity.onOutdatedClient()
    } else {
      this.#activity.onError()
    }
    console.error(err)
  }
}

/**
 * @param {object} args
 * @param {number} args.roundLengthInMs
 * @param {number} args.maxTasksPerRound
 * @param {number} args.lastTaskDurationInMs
 */
export function calculateDelayBeforeNextTask ({
  roundLengthInMs,
  maxTasksPerRound,
  lastTaskDurationInMs
}) {
  const baseDelay = roundLengthInMs / maxTasksPerRound
  const delay = baseDelay - lastTaskDurationInMs
  return Math.min(delay, 60_000)
}

export function newStats () {
  return {
    timeout: false,
    startAt: null,
    firstByteAt: null,
    endAt: null,
    carTooLarge: false,
    byteLength: 0,
    carChecksum: null,
    statusCode: null,
    headStatusCode: null
  }
}

export function getRetrievalUrl (protocol, address, cid) {
  if (protocol === 'http') {
    const baseUrl = multiaddrToHttpUrl(address)
    return `${baseUrl}/ipfs/${cid}?dag-scope=block`
  }

  const searchParams = new URLSearchParams({
    // See https://github.com/filecoin-project/lassie/blob/main/docs/HTTP_SPEC.md#dag-scope-request-query-parameter
    // Only the root block at the end of the path is returned after blocks required to verify the specified path segments.
    'dag-scope': 'block',
    protocols: protocol,
    providers: address
  })
  return `ipfs://${cid}?${searchParams.toString()}`
}

/**
 * @param {string} cid
 * @param {Uint8Array} carBytes
 */
async function verifyContent (cid, carBytes) {
  let reader
  try {
    reader = await CarBlockIterator.fromBytes(carBytes)
  } catch (err) {
    throw Object.assign(err, { code: 'CANNOT_PARSE_CAR_BYTES' })
  }

  for await (const block of reader) {
    if (block.cid.toString() !== cid.toString()) {
      throw Object.assign(
        new Error(`Unexpected block CID ${block.cid}. Expected: ${cid}`),
        { code: 'UNEXPECTED_CAR_BLOCK' }
      )
    }

    await validateBlock(block)
  }
}

function mapErrorToStatusCode (err) {
  // 7xx codes for multiaddr parsing errors
  switch (err.code) {
    case 'UNSUPPORTED_MULTIADDR_HOST_TYPE':
      return 701
    case 'UNSUPPORTED_MULTIADDR_PROTO':
      return 702
    case 'UNSUPPORTED_MULTIADDR_SCHEME':
      return 703
    case 'MULTIADDR_HAS_TOO_MANY_PARTS':
      return 704
  }

  // 9xx for content verification errors
  if (err instanceof UnsupportedHashError) {
    return 901
  } else if (err instanceof HashMismatchError) {
    return 902
  } else if (err.code === 'UNEXPECTED_CAR_BLOCK') {
    return 903
  } else if (err.code === 'CANNOT_PARSE_CAR_BYTES') {
    return 904
  }

  // 8xx errors for network connection errors
  // Unfortunately, the Fetch API does not support programmatic detection of various error
  // conditions. We have to check the error message text.
  if (err.message.includes('dns error')) {
    return 801
  } else if (err.message.includes('tcp connect error')) {
    return 802
  }

  // Fallback code for unknown errors
  return 600
}
