// this’s a manual testing tool useful for demonstration
import Spark from '../lib/spark.js'

const spark = new Spark()

const testTask = {
  cid: 'bafyreih4wq2ljuzhnn6pzl7tny7khzekqjx7yp6h5rvfbx2hrwrtp6mpcq',
  minerId: 't01234',
}

spark.queueOnDemandRetrieval(testTask)
console.log('On-demand task queued successfully.')
