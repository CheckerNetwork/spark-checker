import { ethers } from '../vendor/deno-deps.js'
import { assert } from 'zinnia:assert'
import { RPC_URL } from './constants.js'

// ABI for the MinerPeerIDMapping contract (minimal ABI with just the method we need)
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

// Contract address on the Filecoin EVM
const CONTRACT_ADDRESS = '0x14183aD016Ddc83D638425D6328009aa390339Ce'
// Singleton instance of the smart contract client
let smartContract
// Initialize provider and contract
async function getSmartContractClient (rpcUrl) {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  return new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
}

/**
 * Query the smart contract for the peer ID mapping
 * @param {string} minerID - The miner ID (as string, will be converted to uint64)
 * @param {object} [options]
 * @param {function} [options.getSmartContractClientFn] - Function to get the smart contract client
 * @returns {Promise<string>} The peer ID from the contract or empty string if not found
 */
export async function getMinerPeerIdFromSmartContract (
  minerID,
  { getSmartContractClientFn } = {}
) {
  try {
    if (!smartContract || getSmartContractClientFn) {
      smartContract = await (
        getSmartContractClientFn ?? getSmartContractClient
      )(RPC_URL)
    }
    assert(smartContract, 'smartContract must be initialized')
    // Convert minerID string (like 'f01234') to numeric ID
    const numericID = parseInt(minerID.replace('f0', ''))
    const peerData = await smartContract.getPeerData(numericID)
    // TODO: Check if peerData.signature is valid
    return peerData?.peerID ?? null
  } catch (error) {
    throw Error(`Error fetching peer ID from contract for miner ${minerID}.`, {
      cause: error
    })
  }
}
