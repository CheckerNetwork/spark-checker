import { decodeBase64, decodeVarint, pRetry, assertOkResponse } from '../vendor/deno-deps.js'

/** @typedef {{ address: string; protocol: string; contextId: string; }} Provider  */

/**
 *
 * @param {string} cid
 * @param {string} providerId
 * @returns {Promise<{
 *  indexerResult: string;
 *  provider?: Provider;
 *  providers: Provider[];
 * }>}
 */
export async function queryTheIndex(cid, providerId) {
  let providerResults
  try {
    providerResults = await pRetry(() => getRetrievalProviders(cid), {
      retries: 5,
      shouldRetry: (error) => {
        return error.statusCode && error.statusCode >= 500
      },
      onFailedAttempt: (error) => {
        console.error(error)
        console.error('IPNI query failed, retrying...')
      },
    })
    console.log('IPNI returned %s provider results', providerResults.length)
  } catch (err) {
    console.error('IPNI query failed.', err)
    return {
      indexerResult: typeof err.statusCode === 'number' ? `ERROR_${err.statusCode}` : 'ERROR_FETCH',
    }
  }

  let httpProvider
  let graphsyncProvider
  const providers = []
  for (const p of providerResults) {
    const [protocolCode] = decodeVarint(decodeBase64(p.Metadata))
    const protocol = {
      0x900: 'bitswap',
      0x910: 'graphsync',
      0x0920: 'http',
      4128768: 'graphsync',
    }[protocolCode]

    const address = p.Provider.Addrs[0]
    if (!address) continue

    const provider = {
      address: protocol === 'http' ? address : `${address}/p2p/${p.Provider.ID}`,
      contextId: p.ContextID,
      protocol,
    }

    switch (protocol) {
      case 'http':
        if (p.Provider.ID === providerId && !httpProvider) {
          httpProvider = provider
        } else {
          providers.push(provider)
        }
        break
      case 'graphsync':
        if (p.Provider.ID === providerId && !graphsyncProvider) {
          graphsyncProvider = provider
        } else {
          providers.push(provider)
        }
        break
    }
  }

  if (httpProvider) {
    return {
      indexerResult: 'OK',
      provider: httpProvider,
      providers,
    }
  }

  if (graphsyncProvider) {
    console.log('HTTP protocol is not advertised, falling back to Graphsync.')
    return {
      indexerResult: 'HTTP_NOT_ADVERTISED',
      provider: graphsyncProvider,
      providers,
    }
  }

  console.log('All advertisements are from other miners or for unsupported protocols.')
  return { indexerResult: 'NO_VALID_ADVERTISEMENT', providers }
}

async function getRetrievalProviders(cid) {
  const url = `https://cid.contact/cid/${encodeURIComponent(cid)}`
  const res = await fetch(url)
  await assertOkResponse(res)

  const result = await res.json()
  return result.MultihashResults.flatMap((r) => r.ProviderResults)
}
