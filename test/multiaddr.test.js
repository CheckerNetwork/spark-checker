import { test } from 'zinnia:test'
import { assertEquals, assertThrows } from 'zinnia:assert'
import { multiaddrToHttpUrl } from '../lib/multiaddr.js'

const HAPPY_CASES = [
  ['/ip4/127.0.0.1/tcp/80/http', 'http://127.0.0.1'],
  ['/ip4/127.0.0.1/tcp/8080/http', 'http://127.0.0.1:8080'],
  ['/ip4/127.0.0.1/tcp/443/https', 'https://127.0.0.1'],
  ['/ip4/127.0.0.1/tcp/8080/https', 'https://127.0.0.1:8080'],
  ['/dns/meridian.space/tcp/8080/http', 'http://meridian.space:8080'],
  ['/dns4/meridian.space/tcp/8080/http', 'http://meridian.space:8080'],
  ['/dns6/meridian.space/tcp/8080/http', 'http://meridian.space:8080'],
  ['/dns/meridian.space/https/http-path/%2Fipni-provider%2F12D3KooWJ91c8xqshrNe7QAXPFAaeRr0Wq2UrgXGPf8UmMZMwyZ5', 'https://meridian.space/ipni-provider/12D3KooWJ91c8xqshrNe7QAXPFAaeRr0Wq2UrgXGPf8UmMZMwyZ5']
]

for (const [multiaddr, expectedUri] of HAPPY_CASES) {
  test(`parse ${multiaddr}`, () => {
    const uri = multiaddrToHttpUrl(multiaddr)
    assertEquals(uri, expectedUri)
  })
}

const ERROR_CASES = [
  ['/ip4/127.0.0.1/tcp/80', 'Cannot parse "/ip4/127.0.0.1/tcp/80": unsupported scheme "undefined"'],
  ['/ip4/127.0.0.1/udp/90', 'Cannot parse "/ip4/127.0.0.1/udp/90": unsupported protocol "udp"'],
  ['/ip4/127.0.0.1/tcp/8080/http/p2p/pubkey', 'Cannot parse "/ip4/127.0.0.1/tcp/8080/http/p2p/pubkey": too many parts']
]

for (const [multiaddr, expectedError] of ERROR_CASES) {
  test(`parse ${multiaddr}`, () => {
    const err = assertThrows(() => multiaddrToHttpUrl(multiaddr))
    assertEquals(err.message, expectedError)
  })
}
