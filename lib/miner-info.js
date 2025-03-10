import { retry } from '../vendor/deno-deps.js'
import { RPC_URL, RPC_AUTH } from './constants.js'
import { getMinerPeerIdFromSmartContract } from './smart-contract-client.js'

async function getChainHead ({ maxAttempts = 5 } = {}) {
  try {
    const res = await retry(() => rpc('Filecoin.ChainHead'), {
      // The maximum amount of attempts until failure.
      maxAttempts,
      // The initial and minimum amount of milliseconds between attempts.
      minTimeout: 5_000,
      // How much to backoff after each retry.
      multiplier: 1.5
    })
    return res.Cids
  } catch (err) {
    if (err.name === 'RetryError' && err.cause) {
      // eslint-disable-next-line no-ex-assign
      err = err.cause
    }
    err.message = `Cannot obtain chain head: ${err.message}`
    throw err
  }
}

/**
 * @param {string} minerId A miner actor id, e.g. `f0142637`
 * @param {object} options
 * @param {number} [options.maxAttempts]
 * @returns {Promise<string>} Miner's PeerId, e.g. `12D3KooWMsPmAA65yHAHgbxgh7CPkEctJHZMeM3rAvoW8CZKxtpG`
 */
export async function getMinerPeerId (minerId, { maxAttempts = 5 } = {}) {
  // Make a concurrent request to both sources: FilecoinMinerInfo and smart contract
  const [minerInfoResult, contractResult] = await Promise.allSettled([
    getMinerPeerIdFromFilecoinMinerInfo(minerId, { maxAttempts }),
    getMinerPeerIdFromSmartContract(minerId)
  ])
  // Check contract result first
  if (contractResult.status === 'fulfilled' && contractResult.value) {
    return contractResult.value
  }

  // Fall back to FilecoinMinerInfo result
  if (minerInfoResult.status === 'fulfilled' && minerInfoResult.value) {
    return minerInfoResult.value
  }

  // Handle the case where both failed
  throw new Error(`Failed to resolve PeerID from any source: ${contractResult.reason}, ${minerInfoResult.reason}`)
}

/**
 * @param {string} minerId A miner actor id, e.g. `f0142637`
 * @param {object} options
 * @param {number} [options.maxAttempts]
 * @returns {Promise<string>} Miner's PeerId, e.g. `12D3KooWMsPmAA65yHAHgbxgh7CPkEctJHZMeM3rAvoW8CZKxtpG`
 */
export async function getMinerPeerIdFromFilecoinMinerInfo (minerId, { maxAttempts = 5 }) {
  const chainHead = await getChainHead({ maxAttempts })
  try {
    const res = await retry(() => rpc('Filecoin.StateMinerInfo', minerId, chainHead), {
      // The maximum amount of attempts until failure.
      maxAttempts,
      // The initial and minimum amount of milliseconds between attempts.
      minTimeout: 5_000,
      // How much to backoff after each retry.
      multiplier: 1.5
    })
    return res.PeerId
  } catch (err) {
    if (err.name === 'RetryError' && err.cause) {
      // eslint-disable-next-line no-ex-assign
      err = err.cause
    }
    err.message = `Cannot obtain miner info for ${minerId}: ${err.message}`
    throw err
  }
}

/**
 * @param {string} method
 * @param {unknown[]} params
 */
async function rpc (method, ...params) {
  const req = new Request(RPC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accepts: 'application/json',
      authorization: `Bearer ${RPC_AUTH}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  })
  const res = await fetch(req, {
    signal: AbortSignal.timeout(60_000)
  })

  if (!res.ok) {
    throw new Error(`JSON RPC failed with ${res.code}: ${(await res.text()).trimEnd()}`)
  }

  const body = await res.json()
  if (body.error) {
    const err = new Error(body.error.message)
    err.name = 'FilecoinRpcError'
    err.code = body.code
    throw err
  }

  return body.result
}
