import type {IncomingMessage,ServerResponse} from 'node:http'
export function createQuizService(options?:{env?:NodeJS.ProcessEnv;fetchImpl?:typeof fetch;now?:()=>number;filename?:string;publicMode?:boolean;timeoutMs?:number}):{
  capability():{enabled:boolean;notice:string;approvedCalls?:number}
  handler(req:IncomingMessage,res:ServerResponse):Promise<void>
  close():void
}
