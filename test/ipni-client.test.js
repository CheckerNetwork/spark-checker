import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { queryTheIndex } from '../lib/ipni-client.js'

const KNOWN_CID = 'bafkreih25dih6ug3xtj73vswccw423b56ilrwmnos4cbwhrceudopdp5sq'
const FRISBEE_PEER_ID = '12D3KooWC8gXxg9LoJ9h3hy3jzBkEAxamyHEQJKtRmAuBuvoMzpr'

test('query advertised CID', async () => {
  const result = await queryTheIndex(KNOWN_CID, FRISBEE_PEER_ID)
  assertEquals(result, {
    indexerResult: 'OK',
    provider: {
      address: '/dns/frisbii.fly.dev/tcp/443/https',
      protocol: 'http',
      contextId: 'ZnJpc2JpaQ==',
    },
    providers: [],
  })
})

test('ignore advertisements from other miners', async () => {
  const result = await queryTheIndex(KNOWN_CID, '12D3KooWsomebodyelse')
  assertEquals(result.indexerResult, 'NO_VALID_ADVERTISEMENT')
})
