// @vitest-environment node
import {it,expect} from 'vitest'
import {Miniflare,convertV4MiniflareOptions} from 'miniflare'
import {build} from 'esbuild'
it('runs the real Worker bundle and SQLite Durable Object in workerd with all model traffic mocked',async()=>{
 const bundle=await build({entryPoints:['cloudflare/worker.mjs'],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*']})
 let calls=0
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'quiz-test',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat'],durableObjects:{QUIZ_BUDGET:{className:'QuizBudget',useSQLite:true}},
  bindings:{PUBLIC_AI_ENABLED:'true',FREE_QUOTA_CONFIRMED:'true',SOURCE_HASH_SECRET:'fixture-hash-secret-at-least-32-characters',AI_API_KEY:'fixture-workerd-key',QUIZ_APPROVED_CALLS:'1000',QUIZ_DAILY_CALLS:'300',QUIZ_SOURCE_MINUTE_CALLS:'20',QUIZ_BUDGET_CNY:'3',QUIZ_INPUT_CNY_PER_MILLION:'.15',QUIZ_OUTPUT_CNY_PER_MILLION:'1.5',QUIZ_PRICE_CHECKED_ON:new Date().toISOString().slice(0,10)},
  outboundService:async request=>{calls++;const body:any=await request.json();const messages=body.messages;const question=messages[0].content.includes('出题员');return Response.json({choices:[{message:{content:JSON.stringify(question?{question:'模拟模型运动知识问题'+calls,referenceAnswer:'服务端隐藏参考',keyPoints:['核心'],explanation:'隐藏解释',topic:'warmup',difficulty:JSON.parse(messages[1].content).difficulty,answerability:'clear'}:{verdict:'correct',basis:'matches_core',explanation:'模拟判题解释',monsterReaction:'模拟怪兽认输'})}}]})}}]}))
 try{
  const request=(route:string,input?:unknown,token?:string)=>mf.dispatchFetch('https://internal/'+route,{method:input?'POST':'GET',headers:{'X-Verified-Source':'192.0.2.1','Content-Type':'application/json',...(token?{'X-Party-Token':token}:{})},body:input?JSON.stringify(input):undefined})
  expect(await (await request('status')).json()).toMatchObject({enabled:true})
  const party:any=await (await request('party',{players:2})).json()
  let id=0
  const levels=['slime-forest','ghost-realm','dragon-castle']
  for(let level=0;level<3;level++){
   for(let player=1;player<=2;player++){
    const op={partyId:party.partyId,levelId:levels[level],levelAttemptId:1,playerId:'player-'+player,operationId:++id,kind:'question'}
    const q:any=await (await request('question',op,party.token)).json()
    expect(q).toMatchObject({source:'ai'});expect(await (await request('question',op,party.token)).json()).toEqual(q)
    const judged=await (await request('judge',{...op,operationId:++id,kind:'judge',questionId:q.questionId,answer:'模拟答案'},party.token)).json()
    expect(judged).toMatchObject({verdict:'correct',monsterReaction:'模拟怪兽认输'})
   }
   if(level<2)expect(await (await request('advance',{partyId:party.partyId,levelId:levels[level],levelAttemptId:1},party.token)).json()).toMatchObject({levelId:levels[level+1]})
  }
  expect(calls).toBe(12)
  const state:any=await (await request('state',{partyId:party.partyId},party.token)).json()
  expect(Object.values(state.turns)).toHaveLength(6)
  expect(Object.values(state.turns).every((t:any)=>t.result.verdict==='correct')).toBe(true)
 }finally{await mf.dispose()}
},20000)
