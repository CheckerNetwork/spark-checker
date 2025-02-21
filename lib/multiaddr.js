/**
 * @param {string} addr Multiaddr, e.g. `/ip4/127.0.0.1/tcp/80/http`
 * @returns {string} Parsed URI, e.g. `http://127.0.0.1:80`
 */
export function multiaddrToHttpUrl (addr) {
  const [multiAddr, httpPathMultiAddr] = addr.split('/http-path/')
  const [, hostType, hostValue, ...multiAddrParts] = multiAddr.split('/')
  let scheme, path, rest
  if (httpPathMultiAddr) {
    scheme = multiAddrParts.shift()
    rest = multiAddrParts
    path = decodeURIComponent(httpPathMultiAddr)
    if (!path) {
      throw Object.assign(
        new Error(`Cannot parse "${addr}": http-path is empty`),
        { code: 'MULTIADDR_HAS_EMPTY_HTTP_PATH' }
      )
    }
  } else {
    const ipProtocol = multiAddrParts.shift()
    const port = multiAddrParts.shift()
    scheme = multiAddrParts.shift()
    rest = multiAddrParts

    if (ipProtocol !== 'tcp') {
      throw Object.assign(
        new Error(`Cannot parse "${addr}": unsupported protocol "${ipProtocol}"`),
        { code: 'UNSUPPORTED_MULTIADDR_PROTO' }
      )
    }
    path = getUriPort(scheme, port)
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
  if (scheme !== 'http' && scheme !== 'https') {
    throw Object.assign(
      new Error(`Cannot parse "${addr}": unsupported scheme "${scheme}"`),
      { code: 'UNSUPPORTED_MULTIADDR_SCHEME' }
    )
  }
  return `${scheme}://${getUriHost(hostType, hostValue)}${path}`
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
