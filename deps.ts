// 3rd-party dependencies from Denoland
//
// Run the following script after making change in this file:
//   deno bundle deps.ts vendor/deno-deps.js
//
// You must use a 1.x version of Deno, e.g. v1.43.1

export { encodeHex } from 'https://deno.land/std@0.203.0/encoding/hex.ts'
export { decodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'
export { decode as decodeVarint } from 'https://deno.land/x/varint@v2.0.0/varint.ts'
export { retry } from 'https://deno.land/std@0.203.0/async/retry.ts';


// Deno Bundle does not support npm dependencies, we have to load them via CDN
export { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.5/dist/ethers.min.js";
export { CarBlockIterator } from 'https://cdn.skypack.dev/@ipld/car@5.3.2/?dts'
export {
  UnsupportedHashError,
  HashMismatchError,
  validateBlock
} from 'https://cdn.skypack.dev/@web3-storage/car-block-validator@1.2.0/?dts'
// cdn.skypack.dev cannot resolve import from @noble/hashes
// jsdelivr.net seems to work better, it's also recommended by drand-client
export {
  fetchBeaconByTime,
  HttpChainClient,
  HttpCachingChain
} from 'https://cdn.jsdelivr.net/npm/drand-client@1.2.6/index.js/+esm'

export { assertOkResponse } from 'https://cdn.skypack.dev/assert-ok-response@1.0.0/?dts'
import pRetry from 'https://cdn.skypack.dev/p-retry@6.2.1/?dts'
export { pRetry }
