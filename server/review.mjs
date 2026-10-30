import { createAIClient } from './ai/client.mjs'
// Server-only: imported by Vite's development server and the optional Vercel function.
const BAD_CLAIMS=/卡路里|千卡|热量|燃脂|脂肪|健康收益|诊断|准确率|心率|疾病|治疗|减重|减肥|公斤|kcal|消耗/i
export function localReview(seconds){
  return {title:seconds<60?'萌芽闪击手':seconds<180?'森林破关者':'从容冒险家',review:'团子揉着眼睛翻开森林日记：今天的守门任务，被你一下一下认真打通了！把这枚萌芽徽章收好，下次冒险再见。',source:'local'}
}
export function validateRound(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return null
  const {roundId,count,seconds,mode}=input
  if(Object.keys(input).some(key=>!['roundId','count','seconds','mode'].includes(key)))return null
  if(typeof roundId!=='string'||!/^[-a-zA-Z0-9]{12,80}$/.test(roundId)||count!==10||mode!=='real'||!Number.isInteger(seconds)||seconds<0||seconds>86400)return null
  return {roundId,count,seconds,mode}
}
export function validateReview(value){
  if(!value||typeof value.title!=='string'||typeof value.review!=='string')return null
  const title=value.title.trim(),review=value.review.trim()
  const monsterLine=typeof value.monsterLine==='string'?value.monsterLine.trim():undefined
  if(monsterLine!==undefined&&(monsterLine.length<2||monsterLine.length>30))return null
  if(title.length<2||title.length>16||review.length<12||review.length>220||BAD_CLAIMS.test(title+review+(monsterLine||''))||/[<>]|https?:|sk-/i.test(title+review+(monsterLine||'')))return null
  return {title,review,...(monsterLine?{monsterLine}:{}),source:'ai'}
}
export function createReviewService({env=process.env,fetchImpl=fetch,now=Date.now,publicMode=false}={}){
  const ai=createAIClient({env,fetchImpl,timeoutMs:8000})
  const cache=new Map(),attempts=[]
  const recentTitles=[]
  let day='',daily=0
  const fallback=(round,notice)=>({...localReview(round.seconds),notice})
  async function generate(round){
    if(publicMode)return fallback(round,'公网 AI 暂未开放，当前为本地备用战报，不产生模型调用')
    if(!ai.status().ready)return fallback(round,ai.status().notice+' 已使用本地战报')
    const currentDay=new Date(now()).toISOString().slice(0,10)
    if(currentDay!==day){day=currentDay;daily=0}
    const limit=Math.min(100,Math.max(1,Number(env.AI_DAILY_LIMIT??env.BAILIAN_DAILY_LIMIT)||20))
    while(attempts.length&&now()-attempts[0]>=60000)attempts.shift()
    if(daily>=limit||attempts.length>=5)return fallback(round,'本地调用额度已用完，已使用本地战报')
    daily++;attempts.push(now())
    const views=['团子投降时递来的认输便签','森林报纸的战斗头条','树洞电台的现场播报','团子写给守门员同事的吐槽','冒险者公会的通关颁奖词','森林路牌留下的俏皮留言']
    const variation=[...round.roundId].reduce((sum,char)=>((sum*31)+char.charCodeAt(0))>>>0,0)%views.length
    try{
      const value=await ai.generateJSON({maxTokens:280,temperature:.9,messages:[{role:'system',content:'你是 GymGoGo 萌芽森林的战报员。只输出 JSON：title（2至16字原创游戏称号）、review（40至100字本局趣味战报）、monsterLine（8至28字团子的第一人称认输吐槽）。遵守本局指定叙事视角，结合提供的实际次数和用时写具体的小故事；短用时可以写剧情紧凑，较长用时可以写从容推进，不由用时推断体能。避免套用“今天的守门任务”“一下一下认真打通了”“把徽章收好”等预设句。不要复用给出的最近称号。不评价动作规范或健康，不编造卡路里、消耗、体重、心率、准确率、排名、用户数据或奖励数值。不出现链接、HTML、真实世界训练效果。'},
          {role:'user',content:JSON.stringify({completed:round.count,elapsedSeconds:round.seconds,monster:'贪睡团子',result:'击败',narrativeView:views[variation],avoidTitles:recentTitles.slice(-3)})}]})
      const parsed=validateReview(value)
      if(parsed){recentTitles.push(parsed.title);if(recentTitles.length>3)recentTitles.shift()}
      return parsed||fallback(round,'AI 战报格式不合适，已使用本地战报')
    }catch(error){
      if(Number.isInteger(error.status))return fallback(round,`AI请求未通过（HTTP ${error.status}${error.providerCode?' · '+error.providerCode:''}），已使用本地战报`)
      return fallback(round,'AI 战报暂时未送达，已使用本地战报')
    }
  }

  async function evaluate(input){
    const round=validateRound(input);if(!round)return {error:'invalid_round'}
    const fingerprint=JSON.stringify(round),existing=cache.get(round.roundId)
    if(existing){if(existing.fingerprint!==fingerprint)return {error:'round_conflict'};return existing.promise}
    if(cache.size>=512){for(const [id,item] of cache){if(now()-item.time>86400000)cache.delete(id)}}
    if(cache.size>=512)return fallback(round,'战报队列已满，已使用本地战报')
    const promise=generate(round).then(result=>({...result,receipt:{id:crypto.randomUUID(),source:result.source,
      model:result.source==='ai'?ai.model:null,generatedAt:new Date(now()).toISOString()}}))
    cache.set(round.roundId,{fingerprint,promise,time:now()});return promise
  }
  async function handler(req,res){
    const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
    if(req.method!=='POST'){res.setHeader('Allow','POST');send(405,{error:'method_not_allowed'});return}
    // Same-origin browser endpoint. No CORS wildcard or arbitrary prompt / URL forwarding.
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){send(403,{error:'origin'});return}}catch{send(403,{error:'origin'});return}}
    if(!String(req.headers['content-type']||'').includes('application/json')){send(415,{error:'content_type'});return}
    try{
      let input=req.body
      if(input===undefined){let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>2048){send(413,{error:'too_large'});return}}input=JSON.parse(raw)}
      else if(typeof input==='string'){if(Buffer.byteLength(input)>2048){send(413,{error:'too_large'});return}input=JSON.parse(input)}
      const result=await evaluate(input);send(result.error?400:200,result)
    }catch{send(400,{error:'invalid_request'})}
  }
  return {evaluate,handler}
}
