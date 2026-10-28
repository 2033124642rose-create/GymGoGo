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
export function createReviewService({env=process.env,fetchImpl=fetch,now=Date.now}={}){
  const cache=new Map(),attempts=[]
  const recentTitles=[]
  let day='',daily=0
  const fallback=(round,notice)=>({...localReview(round.seconds),notice})
  async function generate(round){
    if(!env.DASHSCOPE_API_KEY)return fallback(round,'未配置百炼服务，已使用本地战报')
    let base
    try{
      base=new URL(env.BAILIAN_BASE_URL||'https://dashscope.aliyuncs.com/compatible-mode/v1')
      if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!(/^(dashscope(?:-intl)?\.aliyuncs\.com|[a-zA-Z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com)$/.test(base.hostname)))throw Error()
    }catch{return fallback(round,'百炼地域配置不正确，已使用本地战报')}
    const currentDay=new Date(now()).toISOString().slice(0,10)
    if(currentDay!==day){day=currentDay;daily=0}
    const limit=Math.min(100,Math.max(1,Number(env.BAILIAN_DAILY_LIMIT)||20))
    while(attempts.length&&now()-attempts[0]>=60000)attempts.shift()
    if(daily>=limit||attempts.length>=5)return fallback(round,'本地调用额度已用完，已使用本地战报')
    daily++;attempts.push(now())
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000)
    const views=['团子投降时递来的认输便签','森林报纸的战斗头条','树洞电台的现场播报','团子写给守门员同事的吐槽','冒险者公会的通关颁奖词','森林路牌留下的俏皮留言']
    const variation=[...round.roundId].reduce((sum,char)=>((sum*31)+char.charCodeAt(0))>>>0,0)%views.length
    try{
      const request=fetchImpl(base.href.replace(/\/$/,'')+'/chat/completions',{
        method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.DASHSCOPE_API_KEY}`},
        body:JSON.stringify({model:env.BAILIAN_MODEL||'qwen-flash',enable_thinking:false,max_tokens:280,temperature:.9,response_format:{type:'json_object'},
          messages:[{role:'system',content:'你是 GymGoGo 萌芽森林的战报员。只输出 JSON：title（2至16字原创游戏称号）、review（40至100字本局趣味战报）、monsterLine（8至28字团子的第一人称认输吐槽）。遵守本局指定叙事视角，结合提供的实际次数和用时写具体的小故事；短用时可以写剧情紧凑，较长用时可以写从容推进，不由用时推断体能。避免套用“今天的守门任务”“一下一下认真打通了”“把徽章收好”等预设句。不要复用给出的最近称号。不评价动作规范或健康，不编造卡路里、消耗、体重、心率、准确率、排名、用户数据或奖励数值。不出现链接、HTML、真实世界训练效果。'},
          {role:'user',content:JSON.stringify({completed:round.count,elapsedSeconds:round.seconds,monster:'贪睡团子',result:'击败',narrativeView:views[variation],avoidTitles:recentTitles.slice(-3)})}]})})
      // The race also bounds a stalled response body; no retries consume extra tokens.
      const response=await Promise.race([request.then(async res=>{
        const raw=await res.text();if(raw.length>32000)throw Error('oversized')
        if(!res.ok){
          let code=''
          try{const error=JSON.parse(raw);const candidate=error.error?.code||error.code
            if(typeof candidate==='string'&&/^[A-Za-z0-9_.-]{1,32}$/.test(candidate)&&!candidate.includes('sk-'))code=` · ${candidate}`
          }catch{/* no raw provider message or headers reach the browser */}
          return fallback(round,`百炼请求未通过（HTTP ${res.status}${code}），已使用本地战报`)
        }
        const body=JSON.parse(raw),content=body.choices?.[0]?.message?.content
        if(typeof content!=='string')throw Error('shape')
        const parsed=validateReview(JSON.parse(content))
        if(parsed){recentTitles.push(parsed.title);if(recentTitles.length>3)recentTitles.shift()}
        return parsed
      }),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}))])
      return response||fallback(round,'AI 战报格式不合适，已使用本地战报')
    }catch{return fallback(round,'AI 战报暂时未送达，已使用本地战报')}
    finally{clearTimeout(timeout)}
  }
  async function evaluate(input){
    const round=validateRound(input);if(!round)return {error:'invalid_round'}
    const fingerprint=JSON.stringify(round),existing=cache.get(round.roundId)
    if(existing){if(existing.fingerprint!==fingerprint)return {error:'round_conflict'};return existing.promise}
    if(cache.size>=512){for(const [id,item] of cache){if(now()-item.time>86400000)cache.delete(id)}}
    if(cache.size>=512)return fallback(round,'战报队列已满，已使用本地战报')
    const promise=generate(round).then(result=>({...result,receipt:{id:crypto.randomUUID(),source:result.source,
      model:result.source==='ai'?(env.BAILIAN_MODEL||'qwen-flash'):null,generatedAt:new Date(now()).toISOString()}}))
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
