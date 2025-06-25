/* global Zinnia */

Zinnia.activity.error(
  'Spark update: Filecoin Station and Checker Network programmes ended. The node is no longer contributing to the network, and there will be no further rewards. Thank you for your participation!',
)

while (true) {
  await new Promise((resolve) => setTimeout(resolve, 60_000))
}

// import Spark from './lib/spark.js'
// const spark = new Spark()
// await spark.run()
