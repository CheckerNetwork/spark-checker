import { ethers } from '../vendor/deno-deps.js'
import { assert } from 'zinnia:assert'
import { RPC_URL, RPC_AUTH, MINER_TO_PEERID_CONTRACT_ADDRESS } from './constants.js'

// ABI for the MinerPeerIDMapping contract (minimal ABI with just the method we need)
// Docs for smart contract: https://github.com/filecoin-project/curio/blob/395bc47d0f585cbc869fd4671dc05b1b2f4b18c2/market/ipni/spark/sol/README.md
// Reasoning for smart contract: https://docs.curiostorage.org/curio-market/ipni-interplanetary-network-indexer-provider#ipni-provider-identification
const contractABI = [
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'minerID',
        type: 'uint64'
      }
    ],
    name: 'getPeerData',
    outputs: [
      {
        components: [
          {
            internalType: 'string',
            name: 'peerID',
            type: 'string'
          },
          {
            internalType: 'bytes',
            name: 'signature',
            type: 'bytes'
          }
        ],
        internalType: 'struct MinerPeerIDMapping.PeerData',
        name: '',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

const fetchRequest = new ethers.FetchRequest(RPC_URL)
fetchRequest.setHeader('Authorization', `Bearer ${RPC_AUTH}`)
const provider = new ethers.JsonRpcProvider(fetchRequest)
const defaultClient = new ethers.Contract(MINER_TO_PEERID_CONTRACT_ADDRESS, contractABI, provider)

/**
 * Query the smart contract for the peer ID mapping
 * @param {string} minerID - The miner ID (as string, will be converted to uint64)
 * @param {object} [options]
 * @param {function} [options.smartContract] - A smart contract client to use instead of the default one
 * @returns {Promise<string>} The peer ID from the contract or empty string if not found
 */
export async function getIndexProviderPeerFromSmartContract (
  minerID,
  { smartContract } = {}
) {
  try {
    const contractClient = smartContract ?? defaultClient
    assert(contractClient, 'smartContract must be initialized')
    // Convert minerID string (like 'f01234') to numeric ID
    const numericID = parseInt(minerID.replace('f0', ''))
    assert(!isNaN(numericID), `minerID must be "f0{number}". Actual value: "${minerID}"`)
    const peerData = await contractClient.getPeerData(numericID)
    // TODO: Check if peerData.signature is valid
    return peerData?.peerID ?? null
  } catch (error) {
    throw Error(`Error fetching peer ID from contract for miner ${minerID}.`, {
      cause: error
    })
  }
}
