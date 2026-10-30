// @vitest-environment node
import {describe,it,expect,vi} from 'vitest'
import {spawnSync} from 'node:child_process'
import {createAIClient} from '../server/ai/client.mjs'
import {resolveAIConfig} from '../server/ai/config.mjs'

const legacy={DASHSCOPE_API_KEY:'fixture-legacy-key',BAILIAN_MODEL:'qwen-flash'}
const compatible={AI_PROVIDER:'openai-compatible',AI_BASE_URL:'https://models.example.com/v1',AI_ALLOWED_HOSTS:'models.example.com',AI_API_KEY:'fixture-new-provider-key',AI_MODEL:'studio/example-model'}
const input={messages:[{role:'user' as const,content:'fixture-only'}],maxTokens:400,temperature:.6}
const reply=()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({fixture:true})}}]}))

describe('server AI configuration and protocol adapter (no real network)',()=>{
  it('keeps legacy Bailian configuration and request parameters unchanged',async()=>{
    const fetchImpl=vi.fn(async()=>reply()),client=createAIClient({env:legacy,fetchImpl})
    expect(client.status().ready).toBe(true);expect(client.model).toBe('qwen-flash')
    expect(await client.generateJSON(input)).toEqual({fixture:true})
    const [url,options]=fetchImpl.mock.calls[0] as unknown as [string,RequestInit]
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
    expect(options.headers).toMatchObject({Authorization:'Bearer fixture-legacy-key'})
    expect(JSON.parse(String(options.body))).toMatchObject({model:'qwen-flash',enable_thinking:false,max_tokens:400,response_format:{type:'json_object'}})
    expect(options.redirect).toBe('manual');expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(client.status())).not.toContain(legacy.DASHSCOPE_API_KEY)
  })
  it('prefers canonical server variables and does not silently fall back on an explicit blank',()=>{
    const value=resolveAIConfig({...legacy,AI_API_KEY:'fixture-canonical',AI_MODEL:'qwen-flash',AI_BASE_URL:'https://workspace.cn-beijing.maas.aliyuncs.com/v1/'})
    expect(value).toMatchObject({ok:true,config:{apiKey:'fixture-canonical',baseUrl:'https://workspace.cn-beijing.maas.aliyuncs.com/v1'}})
    expect(resolveAIConfig({...legacy,AI_API_KEY:''})).toMatchObject({ok:false,error:'ai_key'})
    expect(resolveAIConfig({...legacy,AI_MODEL:''})).toMatchObject({ok:false,error:'ai_model'})
  })
  it('switches an explicitly configured compatible provider without Bailian-only fields',async()=>{
    const fetchImpl=vi.fn(async()=>reply()),client=createAIClient({env:{...legacy,...compatible},fetchImpl})
    expect(await client.generateJSON(input)).toEqual({fixture:true})
    const [url,request]=fetchImpl.mock.calls[0] as unknown as [string,RequestInit]
    expect(url).toBe('https://models.example.com/v1/chat/completions')
    expect(request.headers).toMatchObject({Authorization:'Bearer fixture-new-provider-key'})
    const body=JSON.parse(String(request.body));expect(body.model).toBe('studio/example-model')
    expect(body).not.toHaveProperty('enable_thinking')
  })
  it('never inherits a Bailian key or model for a different provider',()=>{
    const {AI_API_KEY:_key,...withoutKey}=compatible
    expect(resolveAIConfig({...legacy,...withoutKey})).toMatchObject({ok:false,error:'ai_key'})
    const {AI_MODEL:_model,...withoutModel}=compatible
    expect(resolveAIConfig({...legacy,...withoutModel})).toMatchObject({ok:false,error:'ai_model'})
  })
  it.each([
    {AI_PROVIDER:'unknown'}, {AI_API_STYLE:'unsupported'}, {AI_MODEL:'invalid model'}, {AI_API_KEY:'fixture\ninvalid'},
    {AI_BASE_URL:'http://dashscope.aliyuncs.com/v1'}, {AI_BASE_URL:'https://127.0.0.1/v1'},
    {AI_BASE_URL:'https://fixture:secret@dashscope.aliyuncs.com/v1'}, {AI_BASE_URL:'https://dashscope.aliyuncs.com/v1?key=fixture'},
    {AI_BASE_URL:'https://dashscope.aliyuncs.com/v1#secret'}, {AI_BASE_URL:'https://dashscope.aliyuncs.com:8443/v1'},
    {AI_BASE_URL:'https://evil.example.com/v1'}, {AI_BASE_URL:'https://dashscope.aliyuncs.com/v1/chat/completions'},
  ])('fails safely on invalid configuration without making a request: %j',async overrides=>{
    const fetchImpl=vi.fn(),client=createAIClient({env:{...legacy,...overrides},fetchImpl})
    expect(client.status().ready).toBe(false)
    await expect(client.generateJSON(input)).rejects.toThrow('model_config')
    expect(fetchImpl).not.toHaveBeenCalled();expect(JSON.stringify(client.status())).not.toContain('fixture')
  })
  it.each(['','*.example.com','another.example.com','127.0.0.1','models.example.com:443'])('requires an exact trusted hostname: %s',AI_ALLOWED_HOSTS=>{
    expect(resolveAIConfig({...compatible,AI_ALLOWED_HOSTS})).toMatchObject({ok:false,error:'ai_base_url'})
  })
  it.each([[403,'model_forbidden'],[429,'model_busy'],[401,'model_unavailable'],[500,'model_unavailable']])('maps HTTP %s without exposing provider details',async(status,message)=>{
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({error:{code:'AccessDenied',message:'private '+legacy.DASHSCOPE_API_KEY}}),{status:Number(status)}))
    const client=createAIClient({env:legacy,fetchImpl})
    await expect(client.generateJSON(input)).rejects.toMatchObject({message,status,providerCode:'AccessDenied'})
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('preserves a forbidden response even without a response body',async()=>{
    await expect(createAIClient({env:legacy,fetchImpl:vi.fn(async()=>new Response(null,{status:403}))}).generateJSON(input)).rejects.toThrow('model_forbidden')
  })
  it('redacts transport errors, never retries, and rejects malformed or oversized model output',async()=>{
    const fetchImpl=vi.fn().mockRejectedValue(Error('private '+legacy.DASHSCOPE_API_KEY))
    await expect(createAIClient({env:legacy,fetchImpl}).generateJSON(input)).rejects.toThrow('model_unavailable')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    for(const body of ['not JSON',JSON.stringify({choices:[{message:{content:'not JSON'}}]}),'x'.repeat(32001)]){
      await expect(createAIClient({env:legacy,fetchImpl:vi.fn(async()=>new Response(body))}).generateJSON(input)).rejects.toThrow('model_format')
    }
  })
  it('rejects an oversized prompt or output allowance before any request',async()=>{
    const fetchImpl=vi.fn(),client=createAIClient({env:legacy,fetchImpl})
    await expect(client.generateJSON({...input,maxTokens:401})).rejects.toThrow('invalid_model_request')
    await expect(client.generateJSON({...input,messages:[{role:'user',content:'x'.repeat(9001)}]})).rejects.toThrow('input_too_large')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('has a bounded timeout even if the transport ignores its abort signal',async()=>{
    vi.useFakeTimers()
    try{
      const fetchImpl=vi.fn(()=>new Promise<Response>(()=>{})),client=createAIClient({env:legacy,fetchImpl,timeoutMs:40})
      const check=expect(client.generateJSON(input)).rejects.toThrow('model_timeout')
      await vi.advanceTimersByTimeAsync(40);await check;expect(fetchImpl).toHaveBeenCalledTimes(1)
    }finally{vi.useRealTimers()}
  })
  it('ignores local environment / Wrangler secrets and retains the empty public template',()=>{
    for(const name of ['.env','.env.local','.env.production','.env.production.local','.env-backup','.dev.vars','.dev.vars.production','.wrangler/state/key']){
      const result=spawnSync('git',['-c','safe.directory=D:/gymgogogo','check-ignore','--no-index','-q',name])
      expect(result.status,name).toBe(0)
    }
    expect(spawnSync('git',['-c','safe.directory=D:/gymgogogo','check-ignore','--no-index','-q','.env.example']).status).toBe(1)
  })
})
