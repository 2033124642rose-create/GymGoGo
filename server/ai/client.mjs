import { resolveAIConfig } from './config.mjs'
import { openAICompatibleJSON } from './openai-compatible.mjs'

export function createAIClient({env=process.env,fetchImpl=fetch,timeoutMs=12000}={}) {
  const resolved=resolveAIConfig(env)
  // Only this safe status / model identity may be used in capabilities and receipts.
  const status=resolved.ok?{ready:true,notice:''}:{ready:false,notice:resolved.notice}
  return {
    status:()=>({...status}),
    model:resolved.ok?resolved.config.model:null,
    provider:resolved.ok?resolved.config.provider:null,
    async generateJSON({messages,maxTokens,temperature}) {
      if(!resolved.ok)throw Error('model_config')
      if(!Array.isArray(messages)||!messages.length||Buffer.byteLength(JSON.stringify(messages),'utf8')>9000)throw Error('input_too_large')
      if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>400||!Number.isFinite(temperature)||temperature<0||temperature>2)throw Error('invalid_model_request')
      const controller=new AbortController()
      const timer=setTimeout(()=>controller.abort(),Number.isFinite(timeoutMs)?Math.max(1,Math.min(12000,timeoutMs)):12000)
      const abort=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('model_timeout')),{once:true}))
      try {
        // No retries or fallback providers: each call corresponds to exactly one reserved attempt.
        return await Promise.race([openAICompatibleJSON(resolved.config,{messages,maxTokens,temperature},{fetchImpl,signal:controller.signal}),abort])
      }catch(error){
        if(controller.signal.aborted)throw Error('model_timeout')
        // Never propagate transport messages, URLs, headers or raw provider bodies.
        if(['model_format','model_forbidden','model_busy','model_unavailable'].includes(error?.message))throw error
        throw Error('model_unavailable')
      }finally{clearTimeout(timer)}
    },
  }
}
