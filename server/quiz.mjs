import { createQuizService as createCore } from './quiz-core.mjs'
import { openQuizStore } from './quiz-store.mjs'
export function createQuizService(options={}){return createCore({...options,openStore:openQuizStore})}
