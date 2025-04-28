import { test } from 'zinnia:test'
import {
  AssertionError,
  assertStringIncludes,
  assertRejects,
} from 'zinnia:assert'
import { assertRedirectResponse } from '../lib/http-assertions.js'

test('assertRedirectResponse - 302', async () => {
  const responseMock = {
    status: 302,
    headers: new Headers({ location: '/new-location' }),
    async text() {
      throw new AssertionError('res.text() should not have been called')
    },
  }

  await assertRedirectResponse(responseMock)
})

test('assertRedirectResponse - mission Location header', async () => {
  const responseMock = {
    status: 302,
    headers: new Headers(),
    async text() {
      throw new AssertionError('res.text() should not have been called')
    },
  }

  const err = await assertRejects(() => assertRedirectResponse(responseMock))
  assertStringIncludes(err.message, 'Location')
})

test('assertRedirectResponse - not redirect', async () => {
  const responseMock = {
    status: 200,
    headers: new Headers(),
    async text() {
      return 'RESPONSE BODY'
    },
  }

  const err = await assertRejects(() =>
    assertRedirectResponse(responseMock, 'NOT REDIRECT'),
  )
  assertStringIncludes(err.message, 'NOT REDIRECT')
  assertStringIncludes(err.message, 'RESPONSE BODY')
})
