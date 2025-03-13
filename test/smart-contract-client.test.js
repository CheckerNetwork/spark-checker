import { assertEquals, assertRejects, assert, assertStringIncludes } from 'zinnia:assert'
import { getIndexProviderPeerFromSmartContract } from '../lib/smart-contract-client.js'
import { getIndexProviderPeerId } from '../lib/miner-info.js'
import { test } from 'zinnia:test'

const validPeerIdResponse = {
  peerID: '12D3KooWGQmdpbssrYHWFTwwbKmKL3i54EJC9j7RRNb47U9jUv1U',
  signature: '0x1234567890abcdef'
}

const emptyPeerIdResponse = {
  peerID: '',
  signature: '0x'
}

// Mock contract factory
function createMockContract (mockResponses) {
  return {
    getPeerData: async (minerId) => {
      const response = mockResponses[minerId]
      if (!response) {
        throw new Error(`Miner ID ${minerId} not found in contract`)
      }
      return response
    }
  }
}

test('getIndexProviderPeerFromSmartContract returns peer ID for valid miner ID', async () => {
  // Create mock contract with predefined responses
  const minerId = 12345
  const mockContract = createMockContract({
    [minerId]: validPeerIdResponse
  })

  const actualPeerId = await getIndexProviderPeerFromSmartContract(`f0${minerId}`, {
    smartContract: mockContract
  })

  assertEquals(actualPeerId, validPeerIdResponse.peerID)
})

test('getIndexProviderPeerFromSmartContract returns correct peer id for miner f03303347', async () => {
  const peerId = await getIndexProviderPeerFromSmartContract('f03303347')
  assertEquals(typeof peerId, 'string', 'Expected peerId to be a string')
  assertEquals(peerId, '12D3KooWJ91c6xQshrNe7QAXPFAaeRrHWq2UrgXGPf8UmMZMwyZ5')
})

test('getIndexProviderPeerFromSmartContract returns empty string for miner ID with no peer ID', async () => {
  // Create mock contract with predefined responses
  const minerId = 99999
  const mockContract = createMockContract({
    [minerId]: emptyPeerIdResponse
  })

  const actualPeerId = await getIndexProviderPeerFromSmartContract(`f0${minerId}`, {
    smartContract: mockContract
  })

  assertEquals(actualPeerId, '')
})

test('getIndexProviderPeerFromSmartContract returns an error if the miner id is not a number', async () => {
  const err = await assertRejects(async () => getIndexProviderPeerFromSmartContract('abcdef'), Error)
  assertStringIncludes(err.cause.toString(), 'minerID must be "f0{number}"')
})

test('getIndexProviderPeerFromSmartContract throws error for non-existent miner ID', async () => {
  // Create mock contract with predefined responses (empty to cause error)
  const mockContract = createMockContract({})
  const err = await assertRejects(
    async () => {
      await getIndexProviderPeerFromSmartContract('f055555', {
        smartContract: mockContract
      })
    },
    Error
  )
  assertStringIncludes(err.message, 'Error fetching peer ID from contract for miner')
})

test('getIndexProviderPeerFromSmartContract properly strips f0 prefix', async () => {
  // Create a mock that validates the minerId was correctly converted
  let receivedMinerId = null

  const mockContract = {
    getPeerData: async (minerId) => {
      receivedMinerId = minerId
      return validPeerIdResponse
    }
  }

  await getIndexProviderPeerFromSmartContract('f0123456', {
    smartContract: mockContract
  })

  assertEquals(receivedMinerId, 123456)
})

test('getIndexProviderPeerId returns correct peer id for miner f03303347', async () => {
  const peerId = await getIndexProviderPeerId('f03303347')

  assert(typeof peerId === 'string', 'Expected peerId to be a string')
  assertEquals(peerId, '12D3KooWJ91c6xQshrNe7QAXPFAaeRrHWq2UrgXGPf8UmMZMwyZ5')
})

test('getIndexProviderPeerId returns peer ID from smart contract as the primary source', async () => {
  const minerId = 3303347
  const mockContract = createMockContract({
    [minerId]: validPeerIdResponse
  })
  const actualPeerId = await getIndexProviderPeerId(`f0${minerId}`, {
    smartContract: mockContract
  })
  assertEquals(actualPeerId, validPeerIdResponse.peerID)
})

test('getIndexProviderPeerId returns peer ID from FilecoinMinerInfo as the secondary source if smart contract peer ID is empty', async () => {
  const minerId = 3303347
  const mockContract = createMockContract({
    [minerId]: emptyPeerIdResponse
  })
  const actualPeerId = await getIndexProviderPeerId(`f0${minerId}`, {
    smartContract: mockContract,
    rpcFn: () => Promise.resolve({ PeerId: validPeerIdResponse.peerID })
  })
  assertEquals(actualPeerId, validPeerIdResponse.peerID)
})

test('getIndexProviderPeerId returns peer ID from FilecoinMinerInfo as the secondary source if smart contract peer ID is undefined', async () => {
  const minerId = 3303347
  const mockContract = createMockContract({
    [minerId]: { peerID: undefined }
  })
  const actualPeerId = await getIndexProviderPeerId(`f0${minerId}`, {
    smartContract: mockContract,
    rpcFn: () => Promise.resolve({ PeerId: validPeerIdResponse.peerID })
  })
  assertEquals(actualPeerId, validPeerIdResponse.peerID)
})

test('getIndexProviderPeerId throws error if both sources fail', async () => {
  const minerId = 3303347
  const err = await assertRejects(
    () => getIndexProviderPeerId(`f0${minerId}`, {
      smartContract: () => { throw Error('SMART CONTRACT ERROR') },
      rpcFn: () => { throw Error('MINER INFO ERROR') }
    }),
    Error
  )
  assertStringIncludes(err.message, 'Error fetching PeerID for miner f03303347.')
})

test('getIndexProviderPeerId throws an Error if only the smart contract call fails', async () => {
  const minerId = 3303347
  const err = await assertRejects(() => getIndexProviderPeerId(`f0${minerId}`, {
    smartContract: () => { throw Error('SMART CONTRACT ERROR') },
    rpcFn: () => Promise.resolve({ PeerId: validPeerIdResponse.peerID })
  }))
  console.log(err)
  assertStringIncludes(err.message, `Error fetching PeerID for miner f0${minerId}`)
})

test('getIndexProviderPeerId throws an Error if only the FilecoinMinerInfo fails', async () => {
  const minerId = 3303347
  const mockContract = createMockContract({
    [minerId]: { peerID: undefined }
  })
  const err = await assertRejects(() => getIndexProviderPeerId(`f0${minerId}`, {
    smartContract: mockContract,
    rpcFn: () => { throw Error('MINER INFO ERROR') }
  }))
  assertStringIncludes(err.message, 'Error fetching PeerID for miner f03303347.')
})
