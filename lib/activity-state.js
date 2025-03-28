/* global Zinnia */

// Create activity events when we become healthy or produce errors
export class ActivityState {
  #healthy = null

  onOutdatedClient() {
    this.onError('SPARK is outdated. Please upgrade Filecoin Station to the latest version.')
  }

  onError(msg) {
    if (this.#healthy === null || this.#healthy) {
      this.#healthy = false
      Zinnia.activity.error(msg ?? 'SPARK failed reporting retrieval')
    }
  }

  onHealthy() {
    if (this.#healthy === null) {
      this.#healthy = true
      Zinnia.activity.info('SPARK started reporting retrievals')
    } else if (!this.#healthy) {
      this.#healthy = true
      Zinnia.activity.info('SPARK retrieval reporting resumed')
    }
  }
}
