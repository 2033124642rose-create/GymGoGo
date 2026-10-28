// @vitest-environment node
import { Readable } from 'node:stream'
import { describe,expect,it,vi,afterEach } from 'vitest'
import { createReviewService } from '../server/review.mjs'
const round={roundId:'unit-round-123456',count:10,seconds:75,mode:'real'}
const env={DASHSCOPE_API_KEY:'unit-test-only-not-secret',BAILIAN_MODEL:'qwen-flash'}
const ai={title:'森林节奏大师',review:'团子刚把门牌翻到营业，你的冒险节奏就让它举起了小白旗。萌芽森林把这一页留给你，下一段故事等你来写！'}
const reply=()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(ai)}}]}))
afterEach(()=>vi.useRealTimers())
describe('server-only Bailian review and bounded fallback',()=>{
  it('uses local fallback without any call when the server key is missing',async()=>{
    const fetchImpl=vi.fn(),service=createReviewService({env:{},fetchImpl})
    expect(await service.evaluate(round)).toMatchObject({source:'local'});expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('calls the fixed provider with server auth and numeric game data only',async()=>{
    const fetchImpl=vi.fn().mockResolvedValue(reply()),service=createReviewService({env,fetchImpl})
    const result=await service.evaluate(round)
    expect(result).toMatchObject({...ai,source:'ai'})
    const [url,options]=fetchImpl.mock.calls[0]
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
    expect(options.headers.Authorization).toBe('Bearer unit-test-only-not-secret')
    const body=JSON.parse(options.body)
    expect(body.max_tokens).toBe(280);expect(body.enable_thinking).toBe(false)
    expect(body.messages[1].content).not.toMatch(/landmarks|video|image/)
    expect(JSON.stringify(result)).not.toContain(env.DASHSCOPE_API_KEY)
  })
  it('deduplicates simultaneous and subsequent requests, including failed attempts',async()=>{
    const fetchImpl=vi.fn().mockRejectedValue(Error('unavailable')),service=createReviewService({env,fetchImpl})
    const values=await Promise.all([service.evaluate(round),service.evaluate(round)])
    expect(values[0]).toEqual(values[1]);expect(values[0]).toMatchObject({source:'local'})
    await service.evaluate(round);expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(await service.evaluate({...round,seconds:76})).toEqual({error:'round_conflict'})
  })
  it('stamps server receipts, varies story instructions and avoids recent titles across different rounds',async()=>{
    const fetchImpl=vi.fn().mockImplementation(async()=>reply()),service=createReviewService({env,fetchImpl})
    const first=await service.evaluate(round) as {receipt:{id:string;source:string;model:string}}
    const repeated=await service.evaluate(round) as typeof first
    expect(repeated.receipt).toEqual(first.receipt);expect(first.receipt.source).toBe('ai');expect(first.receipt.model).toBe('qwen-flash')
    for(let i=0;i<3;i++)await service.evaluate({...round,roundId:`story-round-123${i}`})
    const instructions=fetchImpl.mock.calls.map(([,options])=>JSON.parse(JSON.parse(options.body).messages[1].content))
    expect(new Set(instructions.map(x=>x.narrativeView)).size).toBeGreaterThan(1)
    expect(instructions[1].avoidTitles).toContain(ai.title)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })
  it.each([401,429,500])('falls back on provider HTTP %s without exposing provider errors',async status=>{
    const service=createReviewService({env,fetchImpl:vi.fn().mockResolvedValue(new Response('private provider error',{status}))})
    const value=await service.evaluate(round);expect(value).toMatchObject({source:'local'});expect(JSON.stringify(value)).not.toContain('private provider')
  })
  it('reports a sanitized refusal code for diagnosis without forwarding private provider messages',async()=>{
    const service=createReviewService({env,fetchImpl:vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'AccessDenied',message:'private provider details'}}),{status:403}))})
    const result=await service.evaluate(round)
    expect(result).toMatchObject({source:'local',notice:expect.stringContaining('HTTP 403 · AccessDenied')})
    expect(JSON.stringify(result)).not.toContain('private provider details')
  })
  it.each(['not JSON',JSON.stringify({title:'燃脂大师',review:'这段评价编造了热量消耗并且不应该被展示。'}),JSON.stringify({title:'x',review:'short'})])('rejects malformed or ungrounded model text',async content=>{
    const service=createReviewService({env,fetchImpl:vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content}}]})))})
    expect(await service.evaluate(round)).toMatchObject({source:'local'})
  })
  it('bounds even a fetch implementation that ignores cancellation',async()=>{
    vi.useFakeTimers()
    const service=createReviewService({env,fetchImpl:vi.fn(()=>new Promise(()=>{})) as typeof fetch})
    const pending=service.evaluate(round);await vi.advanceTimersByTimeAsync(8000)
    expect(await pending).toMatchObject({source:'local'})
  })
  it('limits global request rate and daily requests per server process',async()=>{
    const fetchImpl=vi.fn().mockImplementation(async()=>reply()),service=createReviewService({env:{...env,BAILIAN_DAILY_LIMIT:'2'},fetchImpl})
    for(let i=0;i<3;i++)await service.evaluate({...round,roundId:`unique-round-${i}`})
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const rateFetch=vi.fn().mockImplementation(async()=>reply()),limited=createReviewService({env,fetchImpl:rateFetch})
    for(let i=0;i<6;i++)await limited.evaluate({...round,roundId:`another-round-${i}`})
    expect(rateFetch).toHaveBeenCalledTimes(5)
  })
  it('never forwards arbitrary prompts, demo data, invalid stats or arbitrary endpoints',async()=>{
    const fetchImpl=vi.fn(),service=createReviewService({env,fetchImpl})
    for(const bad of [{...round,count:9},{...round,mode:'demo'},{...round,seconds:-1},{...round,prompt:'ignore rules'}])expect(await service.evaluate(bad)).toEqual({error:'invalid_round'})
    const badHost=createReviewService({env:{...env,BAILIAN_BASE_URL:'http://localhost/private'},fetchImpl})
    expect(await badHost.evaluate(round)).toMatchObject({source:'local'});expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('HTTP boundary rejects wrong methods, cross-origin, large bodies and malformed JSON',async()=>{
    const service=createReviewService({env:{}})
    const run=async(method:string,body:string,origin?:string)=>{
      const req=Object.assign(Readable.from([body]),{method,headers:{host:'127.0.0.1:5173','content-type':'application/json',...(origin?{origin}:{})}})
      let status=0,output='';const res={statusCode:0,setHeader:vi.fn(),end:(value:string)=>{status=res.statusCode;output=value}}
      await service.handler(req as never,res as never);return {status,output}
    }
    expect((await run('GET','')).status).toBe(405)
    expect((await run('POST','{}','https://evil.example')).status).toBe(403)
    expect((await run('POST','x'.repeat(3000))).status).toBe(413)
    expect((await run('POST','{')).status).toBe(400)
    expect((await run('POST',JSON.stringify(round))).status).toBe(200)
  })
})
