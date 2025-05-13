/* global Zinnia */

import { ActivityState } from './activity-state.js'
import { encodeHex } from '../vendor/deno-deps.js'
import { assertOkResponse, assertRedirectResponse } from './http-assertions.js'
import { getRandomnessForSparkRound } from './drand-client.js'
import { assertEquals, assertInstanceOf } from 'zinnia:assert'

/** @typedef {{ cid: string; minerId: string }} RetrievalTask */
/** @typedef {RetrievalTask & { key: string }} KeyedRetrievalTask */

export class Tasker {
  #lastRoundUrl
  /** @type {Task[]} */
  #remainingRoundTasks
  #onDemandTasks
  #fetch
  #activity

  /**
   * @param {object} args
   * @param {globalThis.fetch} args.fetch
   * @param {ActivityState} args.activityState
   */
  constructor({
    fetch = globalThis.fetch,
    activityState = new ActivityState(),
  } = {}) {
    this.#fetch = fetch
    this.#activity = activityState

    this.maxTasksPerRound = 360

    // TODO: persist these two values across module restarts
    // Without persistence, after the Spark module is restarted, it will start executing the same
    // retrieval tasks we have already executed
    this.#lastRoundUrl = 'unknown'
    this.#remainingRoundTasks = []

    this.#onDemandTasks = []
  }

  /** @returns {Task | undefined} */
  async next() {
    if (this.#onDemandTasks.length > 0) {
    console.log('Returning on-demand retrieval task.')
    return this.#onDemandTasks.pop()
  }

    await this.#updateCurrentRound()
    return this.#remainingRoundTasks.pop()
  }

  async #updateCurrentRound() {
    console.log('Checking the current SPARK round...')
    let res = await this.#fetch('https://api.filspark.com/rounds/current', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })

    await assertRedirectResponse(
      res,
      'Failed to find the URL of the current SPARK round',
    )
    const roundUrl = res.headers.get('location')
    this.#activity.onHealthy()
    if (roundUrl === this.#lastRoundUrl) {
      console.log('Round did not change since the last iteration')
      return
    }

    console.log('Fetching round details at location %s', roundUrl)
    res = await this.#fetch(`https://api.filspark.com${roundUrl}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    await assertOkResponse(res, 'Failed to fetch the current SPARK round')
    const { retrievalTasks, maxTasksPerNode, ...round } = await res.json()
    console.log('Current SPARK round:', round)
    console.log('  %s max tasks per round', maxTasksPerNode ?? '<n/a>')
    console.log('  %s retrieval tasks', retrievalTasks.length)
    this.maxTasksPerRound = maxTasksPerNode

    const randomness = await getRandomnessForSparkRound(round.startEpoch)
    console.log('  randomness: %s', randomness)

    this.#remainingRoundTasks = await pickTasksForNode({
      tasks: retrievalTasks,
      maxTasksPerRound: this.maxTasksPerRound,
      randomness,
      stationId: Zinnia.stationId,
    })

    this.#lastRoundUrl = roundUrl
  }
  /**
   * Queue a retrieval task for immediate execution.
   * This task will be processed before regular round-based tasks.
   * 
   * @param {Task} task - A valid retrieval task ({ cid, minerId })
   */
  queueOnDemandTask(task) {
    if (!task || typeof task.cid !== 'string' || typeof task.minerId !== 'string') {
      throw new Error('Invalid on-demand task. Must include cid and minerId as strings.')
    }
    // for future improvements prevent duplicates or apply rate limiting
    console.log('Queued on-demand task for miner:', task.minerId)
    task.isOnDemand = true
    this.#onDemandTasks.push(task)
  }
}

const textEncoder = new TextEncoder()

/**
 * @param {Task} task
 * @param {string} randomness
 * @returns
 */
export async function getTaskKey(task, randomness) {
  assertEquals(typeof task, 'object', 'task must be an object')
  assertEquals(typeof task.cid, 'string', 'task.cid must be a string')
  assertEquals(typeof task.minerId, 'string', 'task.minerId must be a string')
  assertEquals(typeof randomness, 'string', 'randomness must be a string')

  const data = [task.cid, task.minerId, randomness].join('\n')
  const hash = await crypto.subtle.digest('sha-256', textEncoder.encode(data))
  return BigInt('0x' + encodeHex(hash))
}

/** @param {string} stationId */
export async function getStationKey(stationId) {
  assertEquals(typeof stationId, 'string', 'stationId must be a string')

  const hash = await crypto.subtle.digest(
    'sha-256',
    textEncoder.encode(stationId),
  )
  return BigInt('0x' + encodeHex(hash))
}

/**
 * @param {object} args
 * @param {Task[]} args.tasks
 * @param {string} args.stationId
 * @param {string} args.randomness
 * @param {number} args.maxTasksPerRound
 * @returns {Promise<Task[]>}
 */
export async function pickTasksForNode({
  tasks,
  stationId,
  randomness,
  maxTasksPerRound,
}) {
  assertInstanceOf(tasks, Array, 'tasks must be an array')
  assertEquals(typeof stationId, 'string', 'stationId must be a string')
  assertEquals(typeof randomness, 'string', 'randomness must be a string')
  assertEquals(
    typeof maxTasksPerRound,
    'number',
    'maxTasksPerRound must be a number',
  )

  const keyedTasks = await Promise.all(
    tasks.map(async (t) => ({ ...t, key: await getTaskKey(t, randomness) })),
  )
  const stationKey = await getStationKey(stationId)

  /**
   * @param {{ key: bigint }} a
   * @param {{ key: bigint }} b
   * @returns {number}
   */
  const comparator = (a, b) => {
    const ad = a.key ^ stationKey
    const bd = b.key ^ stationKey
    return ad > bd ? 1 : ad < bd ? -1 : 0
  }

  keyedTasks.sort(comparator)
  keyedTasks.splice(maxTasksPerRound)

  return keyedTasks.map(({ key, ...t }) => t)
}
