import {createQuizService} from '../server/quiz-core.mjs'
import {openBudgetStore} from './budget-store.mjs'
import {createHmac,timingSafeEqual} from 'node:crypto'
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}})
const bounded=(v,fallback,max)=>{const n=Number(v??fallback);if(!Number.isInteger(n)||n<1||n>max)throw Error('configuration');return n}
export async function readJSON(request){
  if(!request.headers.get('content-type')?.includes('application/json'))throw Error('invalid_request')
  const reader=request.body?.getReader();if(!reader)throw Error('invalid_request')
  let size=0;const chunks=[]
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw Error('too_large')}chunks.push(Buffer.from(value))}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
export class QuizBudget {
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.tail=Promise.resolve();this.queued=0}
  async fetch(request){
    // Serialize the entire model operation. Queue admission is NOT an accounting mechanism.
    if(this.queued>=4)return json({error:'party_busy'},429)
    this.queued++
    const previous=this.tail;let release
    this.tail=new Promise(resolve=>{release=resolve})
    try{await previous;return await this.run(request)}catch{return json({error:'store_unavailable'},503)}
    finally{this.queued--;release()}
  }
  async run(request){
    const env=this.env,url=new URL(request.url),route=url.pathname.split('/').at(-1)
    if(route!=='admin-status'&&(env.PUBLIC_AI_ENABLED!=='true'||env.FREE_QUOTA_CONFIRMED!=='true'))return json(route==='status'?{enabled:false,notice:'AI知识挑战暂未启用，纯运动冒险仍可使用。'}:{error:'disabled'})
    const limits={total:bounded(env.QUIZ_APPROVED_CALLS,1000,1000000),daily:bounded(env.QUIZ_DAILY_CALLS,300,1000000),sourceDaily:bounded(env.QUIZ_SOURCE_DAILY_CALLS,60,1000000),sourceMinute:bounded(env.QUIZ_SOURCE_MINUTE_CALLS,10,1000000)}
    const source=request.headers.get('X-Quiz-Source')
    if(!/^[a-f0-9]{64}$/.test(source||''))return json({error:'source_unavailable'},403)
    const store=openBudgetStore(this.ctx.storage,{source,limits})
    if(route==='admin-status'){
      const expected=env.QUIZ_ADMIN_TOKEN||'',actual=request.headers.get('Authorization')||''
      if(expected.length<32||actual.length!==expected.length+7||!timingSafeEqual(Buffer.from(actual.slice(7)),Buffer.from(expected))||!actual.startsWith('Bearer '))return json({error:'forbidden'},403)
      const d=store.read();return json({totalCalls:d.totalCalls,reservedCny:d.totalReservedMicro/1e6,day:d.day,dailyCalls:d.dailyCalls,limits})
    }
    const core=createQuizService({env:{...env,GYMGO_QUIZ_ENABLED:'true',QUIZ_APPROVED_CALLS:String(limits.total),QUIZ_DAILY_CALLS:String(limits.daily)},openStore:()=>store,cloud:true,timeoutMs:bounded(env.MODEL_TIMEOUT_MS,12000,12000)})
    const capability=core.capability()
    // A read failure must close even the capability check.
    store.read()
    if(route==='status')return json({...capability,notice:capability.enabled?'AI知识挑战已启用，每人每关一道题；受全站及来源额度保护。':capability.notice})
    if(!capability.enabled)return json({error:'disabled'},503)
    const input=await readJSON(request),token=request.headers.get('X-Party-Token')
    let result
    if(route==='party')result=core.createParty(input.players)
    else if(['question','judge'].includes(route)){
      if(input.kind!==route)return json({error:'invalid_operation'},400)
      result=await core.evaluate(input,token)
    }else if(['state','advance','retry','close'].includes(route))result=core.sessionAction(route,input.partyId,token,input)
    else return json({error:'not_found'},404)
    return json(result,result.error?409:200)
  }
}
// No public Worker route: only a Pages service binding may reach the singleton.
export default {async fetch(request,env){
  if(!env.QUIZ_BUDGET||!env.SOURCE_HASH_SECRET||env.SOURCE_HASH_SECRET.length<32)return json({error:'disabled'},503)
  const source=request.headers.get('X-Verified-Source')
  if(!source||source.length>64)return json({error:'source_unavailable'},403)
  const headers=new Headers(request.headers)
  headers.delete('X-Verified-Source');headers.set('X-Quiz-Source',createHmac('sha256',env.SOURCE_HASH_SECRET).update(source).digest('hex'))
  return env.QUIZ_BUDGET.get(env.QUIZ_BUDGET.idFromName('global-budget-v1')).fetch(new Request(request,{headers}))
}}
