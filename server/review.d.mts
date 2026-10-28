import type { IncomingMessage,ServerResponse } from 'node:http'
export function createReviewService(options?:{env?:NodeJS.ProcessEnv;fetchImpl?:typeof fetch;now?:()=>number;publicMode?:boolean}):{
  handler(req:IncomingMessage,res:ServerResponse):Promise<void>
  evaluate(input:unknown):Promise<unknown>
}
export function localReview(seconds:number):{title:string;review:string;source:string}
export function validateRound(input:unknown):unknown
export function validateReview(input:unknown):unknown
