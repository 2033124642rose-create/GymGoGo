import { createReviewService } from '../server/review.mjs'
// Public MVP deliberately fails closed, even if a key is accidentally configured.
const service=createReviewService({publicMode:true})
export default service.handler
