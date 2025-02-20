import { multiaddr } from '@multiformats/multiaddr'

/**
 * @param {string} addr Multiaddr, e.g. `/ip4/127.0.0.1/tcp/80/http`
 * @returns {string} Parsed URI, e.g. `http://127.0.0.1:80`
 */
export function multiaddrToHttpUrl (addr) {
  const multiaddress = multiaddr(addr)
  const parts = multiaddress.stringTuples()
  let httpProtocol = null
  let ipProtocol = null
  let host = null
  let port = null
  let path = ''
  for (const [code, value] of parts) {
    switch (code) {
      case 4: // IPv4
      case 41: // IPv6
      case 53: // DNS
      case 54: // DNS4
      case 55: // DNS6
      case 56: // DNSaddr
        ipProtocol = deriveIpProtocol(code)
        host = value
        break
      case 6: // TCP
        port = value
        break
      case 480: // HTTP
      case 443: // HTTPS
        httpProtocol = deriveHttpProtocol(code)
        break
      case 481: // HTTP-Path
        path = decodeURIComponent(value)
        break
    }
  }
  if (!ipProtocol || !host || !httpProtocol) {
    throw Object.assign(
      new Error(`Cannot parse "${addr}": missing ipProtocol or host or httpProtocol`),
      { code: 'MULTIADDR_MISSING_PROTOCOL_OR_HOST' })
  }
  const hostString = getUriHost(ipProtocol, host)
  const portString = getUriPort(httpProtocol, port)
  return `${httpProtocol}://${hostString}${portString}${path}`
}

function deriveIpProtocol (code) {
  switch (code) {
    case 4: return 'ip4'
    case 41: return 'ip6'
    case 53: return 'dns'
    case 54: return 'dns4'
    case 55: return 'dns6'
    case 56: return 'dnsaddr'
  }

  throw Object.assign(
    new Error(`Unsupported multiaddr protocol code "${code}"`),
    { code: 'UNSUPPORTED_MULTIADDR_PROTOCOL_CODE' }
  )
}

function deriveHttpProtocol (code) {
  switch (code) {
    case 480: return 'http'
    case 443: return 'https'
  }

  throw Object.assign(
    new Error(`Unsupported multiaddr protocol code "${code}"`),
    { code: 'UNSUPPORTED_MULTIADDR_PROTOCOL_CODE' }
  )
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
