//
// Usage:
// zinnia run manual-check.js
//

import Spark, { getRetrievalUrl } from './lib/spark.js'
import { getMinerPeerId as defaultGetIndexProvider } from './lib/miner-info.js'

// The task to check, replace with your own values
const task = {
  cid: 'baguqeerain5md44iwzfii2xkorih4oabktvzxrg3in32e4ll7r6diliyvsga',
  minerId: 'f02620'
}

const getIndexProviderPeerId = (minerId) =>
  minerId === 'f02620'
    ? '12D3KooWNXvbyvLUUd1qQEqhzjTpVoT5fdYUZEv4RJSxZ3rDF2c7'
    : defaultGetIndexProvider(minerId)

// Run the check
const spark = new Spark({ getIndexProviderPeerId })
const stats = { ...task, indexerResult: null, statusCode: null, byteLength: 0 }
await spark.executeRetrievalCheck(task, stats)
console.log('Measurement: %o', stats)

if (stats.providerAddress && stats.statusCode !== 200) {
  console.log('\nThe retrieval failed.')
  switch (stats.protocol) {
    case 'graphsync':
      console.log('You can get more details by running Lassie manually:\n')
      console.log(
        '  lassie fetch -o /dev/null -vv --dag-scope block --protocols graphsync --providers %s %s',
        JSON.stringify(stats.providerAddress),
        task.cid
      )
      console.log('\nHow to install Lassie: https://github.com/filecoin-project/lassie?tab=readme-ov-file#installation')
      break
    case 'http':
      try {
        const url = getRetrievalUrl(stats.protocol, stats.providerAddress, task.cid)
        console.log('You can get more details by requesting the following URL yourself:\n')
        console.log('  %s', url)
        console.log('\nE.g. using `curl`:')
        console.log('  curl -i %s', JSON.stringify(url))
        console.log('\nYou can also test the retrieval using Lassie:\n')
        console.log(
          '  lassie fetch -o /dev/null -vv --dag-scope block --protocols http --providers %s %s',
          JSON.stringify(stats.providerAddress),
          task.cid
        )
        console.log('\nHow to install Lassie: https://github.com/filecoin-project/lassie?tab=readme-ov-file#installation')
      } catch (err) {
        console.log('The provider address %j cannot be converted to a URL: %s', stats.providerAddress, err.message ?? err)
      }
      break
  }
}
