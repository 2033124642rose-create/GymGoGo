export interface JSONRequest {
  messages: Array<{role:'system'|'user'|'assistant';content:string}>
  maxTokens:number
  temperature:number
}
export interface AIClient {
  status():{ready:boolean;notice:string}
  model:string|null
  provider:string|null
  generateJSON(input:JSONRequest):Promise<unknown>
}
export function createAIClient(options?:{env?:NodeJS.ProcessEnv;fetchImpl?:typeof fetch;timeoutMs?:number}):AIClient
