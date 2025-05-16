/**
 * Tracks per-round retrieval metrics for SPARK:
 *
 * - Total number of retrieval attempts
 * - Number of failed retrievals
 * - Number of unique (PayloadCID, SP) pairs attempted
 */

class RetrievalMetrics {
  constructor() {
    this.roundIndex = 0
    this.retrievalsTotal = 0
    this.retrievalsFailed = 0
    this.uniquePairs = new Set()
  }

  /** Called at the start of a new SPARK round. */
  reset() {
    this.retrievalsTotal = 0
    this.retrievalsFailed = 0
    this.uniquePairs.clear()
    this.roundIndex++
  }

  /**
   * Register a successful or attempted retrieval.
   *
   * @param {string} payloadCID
   * @param {string | number} storageProvider
   */
  recordRetrieval(payloadCID, storageProvider) {
    this.retrievalsTotal += 1
    const key = `${payloadCID}:${storageProvider}`
    this.uniquePairs.add(key)
  }

  /** Must be called separately on error). */
  recordFailure() {
    this.retrievalsFailed += 1
  }

  /** Log metrics for the current round. */
  report() {
    console.log(`[METRICS] Round #${this.roundIndex}`)
    console.log(`  Retrievals attempted: ${this.retrievalsTotal}`)
    console.log(`  Retrievals failed:    ${this.retrievalsFailed}`)
    console.log(`  Unique (PayloadCID, SP) pairs: ${this.uniquePairs.size}`)
  }

  /** Get snapshot of current state. */
  getSnapshot() {
    return {
      round: this.roundIndex,
      total: this.retrievalsTotal,
      failed: this.retrievalsFailed,
      uniquePairCount: this.uniquePairs.size,
    }
  }
}

export const retrievalMetrics = new RetrievalMetrics()
