/**
 * @param {string} addr Multiaddr, e.g. `/ip4/127.0.0.1/tcp/80/http`
 * @returns {string} Parsed URI, e.g. `http://127.0.0.1:80`
 */
export function multiaddrToHttpUrl (addr) {
  const [multiAddr, httpPathMultiAddr] = addr.split('/http-path')
  const [, hostType, hostValue, ...multiAddrParts] = multiAddr.split('/')
  let scheme, path, rest, port
  if (addr.includes('/http-path')) {
    scheme = multiAddrParts.shift()
    rest = multiAddrParts
    try {
      // Remove leading slash and parse URI-encoded path
      // If the http-path is empty, both `.../http-path/` and `.../http-path` are valid.
      // See https://github.com/multiformats/multiaddr/blob/cab92e8e6da2e70c5f1b8aa59976e71e6922b392/protocols/http-path.md#usage
      path = decodeURIComponent(httpPathMultiAddr.replace(/^\/+/, ''))
    } catch (err) {
      throw Object.assign(
        new Error(`Cannot parse "${addr}": unsupported http path`, { cause: err }),
        { code: 'INVALID_HTTP_PATH' }
      )
    }
  } else {
    let ipProtocol
    ;[ipProtocol, port, scheme, ...rest] = multiAddrParts

    if (ipProtocol !== 'tcp') {
      throw Object.assign(
        new Error(`Cannot parse "${addr}": unsupported protocol "${ipProtocol}"`),
        { code: 'UNSUPPORTED_MULTIADDR_PROTO' }
      )
    }
  }

  if (scheme !== 'http' && scheme !== 'https') {
    throw Object.assign(
      new Error(`Cannot parse "${addr}": unsupported scheme "${scheme}"`),
      { code: 'UNSUPPORTED_MULTIADDR_SCHEME' }
    )
  }

  if (rest.length) {
    throw Object.assign(
      new Error(`Cannot parse "${addr}": too many parts`),
      { code: 'MULTIADDR_HAS_TOO_MANY_PARTS' }
    )
  }

  let url = `${scheme}://${getUriHost(hostType, hostValue)}`
  if (port) url += getUriPort(scheme, port)
  if (path) url += path
  return url
}

function getUriHost (hostType, hostValue) {
  switch (hostType) {
    case 'ip4':
    case 'dns':
    case 'dns4':
    case 'dns6':
      return hostValue
    case 'ip6':
      // See https://superuser.com/a/367788/135774:
      // According to RFC2732, literal IPv6 addresses should be put inside square brackets in URLs
      return `[${hostValue}]`
  }

  throw Object.assign(
    new Error(`Unsupported multiaddr host type "${hostType}"`),
    { code: 'UNSUPPORTED_MULTIADDR_HOST_TYPE' }
  )
}

function getUriPort (scheme, port) {
  if (scheme === 'http' && port === '80') return ''
  if (scheme === 'https' && port === '443') return ''
  return `:${port}`
}
