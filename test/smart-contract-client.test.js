import { assertEquals, assertRejects, assert } from 'zinnia:assert'
import { getMinerPeerIdFromSmartContract } from '../lib/smart-contract-client.js'
import { getMinerPeerId } from '../lib/miner-info.js'
import { test } from 'zinnia:test'

const mockPeerIdResponse = {
  peerID: '12D3KooWGQmdpbssrYHWFTwwbKmKL3i54EJC9j7RRNb47U9jUv1U',
  signature: '0x1234567890abcdef'
}

const mockEmptyPeerIdResponse = {
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

test('getMinerPeerIdFromSmartContract returns peer ID for valid miner ID', async () => {
  // Create mock contract with predefined responses
  const peerId = 12345
  const mockContract = createMockContract({
    [peerId]: mockPeerIdResponse
  })

  const actualPeerId = await getMinerPeerIdFromSmartContract(`f0${peerId}`, {
    smartContract: mockContract
  })

  assertEquals(actualPeerId, mockPeerIdResponse.peerID)
})

test('getMinerPeerId returns correct peer id for miner f03303347', async () => {
  const peerId = await getMinerPeerIdFromSmartContract('f03303347')
  assertEquals(typeof peerId, 'string', 'Expected peerId to be a string')
  assertEquals(peerId, '12D3KooWJ91c6xQshrNe7QAXPFAaeRrHWq2UrgXGPf8UmMZMwyZ5')
})

test('getMinerPeerIdFromSmartContract returns empty string for miner ID with no peer ID', async () => {
  // Create mock contract with predefined responses
  const peerId = 99999
  const mockContract = createMockContract({
    [peerId]: mockEmptyPeerIdResponse
  })

  const actualPeerId = await getMinerPeerIdFromSmartContract(`f0${peerId}`, {
    smartContract: mockContract
  })

  assertEquals(actualPeerId, '')
})

test('getMinerPeerIdFromSmartContract throws error for non-existent miner ID', async () => {
  // Create mock contract with predefined responses (empty to cause error)
  const mockContract = createMockContract({})

  await assertRejects(
    async () => {
      await getMinerPeerIdFromSmartContract('f055555', {
        smartContract: mockContract
      })
    },
    Error,
    'Error fetching peer ID from contract for miner f055555'
  )
})

test('getMinerPeerIdFromSmartContract properly strips f0 prefix', async () => {
  // Create a mock that validates the minerId was correctly converted
  let receivedMinerId = null

  const mockContract = {
    getPeerData: async (minerId) => {
      receivedMinerId = minerId
      return mockPeerIdResponse
    }
  }

  await getMinerPeerIdFromSmartContract('f0123456', {
    smartContract: mockContract
  })

  assertEquals(receivedMinerId, 123456)
})

test('getMinerPeerId returns correct peer id for miner f03303347', async () => {
  const peerId = await getMinerPeerId('f03303347')

  assert(typeof peerId === 'string', 'Expected peerId to be a string')
  assertEquals(peerId, '12D3KooWCtiN7tAjeLKL4mashteXdH4htUrzWu8bWN9kDU3qbKjQ')
})
