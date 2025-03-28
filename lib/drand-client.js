import { fetchBeaconByTime, HttpChainClient, HttpCachingChain } from '../vendor/deno-deps.js'

// See https://docs.filecoin.io/networks/mainnet#genesis
const FIL_MAINNET_GENESIS_TS = new Date('2020-08-24T22:00:00Z').getTime()
const FIL_MAINNET_BLOCK_TIME = 30_000 // 30 seconds

/** @type {import('https://cdn.skypack.dev/drand-client@1.2.6/?dts').ChainOptions} */
const DRAND_OPTIONS = {
  // FIXME: beacon verification does not work when using drand-client via CDN :(
  // Without verification, we are blindly trusting https://api.drand.sh/ to provide honest responses.
  // See https://github.com/filecoin-station/spark/issues/86
  disableBeaconVerification: true,
  noCache: false,
  chainVerificationParams: {
    // quicknet
    chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
    publicKey:
      '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  },
}

const DRAND_URL = `https://api2.drand.sh/${DRAND_OPTIONS.chainVerificationParams.chainHash}`
const chain = new HttpCachingChain(DRAND_URL, DRAND_OPTIONS)
const client = new HttpChainClient(chain, DRAND_OPTIONS)

/**
 * @param {number} roundStartEpoch
 */
export async function getRandomnessForSparkRound(roundStartEpoch) {
  const roundStartedAt = roundStartEpoch * FIL_MAINNET_BLOCK_TIME + FIL_MAINNET_GENESIS_TS
  const beacon = await fetchBeaconByTime(client, roundStartedAt)
  return beacon.randomness
}
