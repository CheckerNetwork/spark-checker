/* global Zinnia */

Zinnia.activity.error(
  'Filecoin Station and Checker Network programmes ended. You can uninstall your node now. Thank you for your participation!',
)

while (true) {
  await new Promise((resolve) => setTimeout(resolve, 60_000))
}

// import Spark from './lib/spark.js'
// const spark = new Spark()
// await spark.run()
