import { retry } from '../vendor/deno-deps.js'
import { RPC_URL, RPC_AUTH } from './constants.js'
import { getIndexProviderPeerIdFromSmartContract } from './smart-contract-client.js'

/**
 * @param {object} options
 * @param {number} [options.maxAttempts]
 * @param {function} [options.rpcFn]
 * @returns {Promise<string>} The chain head Cid
 */
async function getChainHead ({ maxAttempts = 5, rpcFn } = {}) {
  try {
    const res = await retry(() => (rpcFn ?? rpc)('Filecoin.ChainHead'), {
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
export async function getIndexProviderPeerId (minerId, { maxAttempts = 5, smartContract, rpcFn } = {}) {
  try {
  // Make a concurrent request to both sources: FilecoinMinerInfo and smart contract
    const [minerInfoResult, contractResult] = await Promise.all([
      getIndexProviderPeerIdFromFilecoinMinerInfo(minerId, { maxAttempts, rpcFn }),
      getIndexProviderPeerIdFromSmartContract(minerId, { smartContract })
    ])
    // Check contract result first
    if (contractResult) {
      console.log('Using PeerID from the smart contract.')
      return contractResult
    }

    // Fall back to FilecoinMinerInfo result
    if (minerInfoResult) {
      console.log('Using PeerID from FilecoinMinerInfo.')
      return minerInfoResult
    }

    // Handle the case where both failed
    throw new Error(`Failed to obtain Miner's Index Provider PeerID.\nSmartContract query result: ${contractResult}\nStateMinerInfo query result: ${minerInfoResult}`)
  } catch (error) {
    console.error('Error fetching PeerID:', error)
    throw Error(`Error fetching PeerID for miner ${minerId}.`, {
      cause: error
    })
  }
}

/**
 * @param {string} minerId A miner actor id, e.g. `f0142637`
 * @param {object} options
 * @param {number} [options.maxAttempts]
 * @param {function} [options.rpcFn]
 * @returns {Promise<string>} Miner's PeerId, e.g. `12D3KooWMsPmAA65yHAHgbxgh7CPkEctJHZMeM3rAvoW8CZKxtpG`
 */
export async function getIndexProviderPeerIdFromFilecoinMinerInfo (minerId, { maxAttempts = 5, rpcFn } = {}) {
  const chainHead = await getChainHead({ maxAttempts, rpcFn })
  try {
    const res = await retry(() => (rpcFn ?? rpc)('Filecoin.StateMinerInfo', minerId, chainHead), {
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
