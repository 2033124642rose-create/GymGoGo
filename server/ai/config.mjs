// Server-only configuration. Never return config (which contains a key) to a browser.
const BAILIAN_BASE='https://dashscope.aliyuncs.com/compatible-mode/v1'
const BAILIAN_HOST=/^(dashscope(?:-intl)?\.aliyuncs\.com|[a-zA-Z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com)$/
const pick=(env,name,legacy,fallback='')=>String(env[name]!==undefined?env[name]:legacy&&env[legacy]!==undefined?env[legacy]:fallback).trim()
const invalid=(error,notice)=>({ok:false,error,notice})

export function resolveAIConfig(env=process.env) {
  const provider=pick(env,'AI_PROVIDER',null,'bailian')
  if(!['bailian','openai-compatible'].includes(provider))return invalid('ai_provider','AI服务商配置不支持，请使用百炼或兼容接口适配器。')
  const apiStyle=pick(env,'AI_API_STYLE',null,'openai-compatible')
  if(apiStyle!=='openai-compatible')return invalid('ai_adapter','AI接口协议不支持，需要独立的服务端适配器。')
  // Legacy values are valid only for Bailian. A new provider must supply its own credentials.
  const bailian=provider==='bailian'
  const apiKey=pick(env,'AI_API_KEY',bailian?'DASHSCOPE_API_KEY':null)
  if(!apiKey||apiKey.length>2048||/[\x00-\x20\x7f]/.test(apiKey))return invalid('ai_key','服务端AI密钥缺失或格式不合适，尚未请求模型。')
  const model=pick(env,'AI_MODEL',bailian?'BAILIAN_MODEL':null,bailian?'qwen-flash':'')
  if(!(bailian?/^[-a-zA-Z0-9_.]{1,80}$/:/^[-a-zA-Z0-9_./:@]{1,128}$/).test(model))return invalid('ai_model','服务端AI模型名称缺失或格式不合适。')
  const base=pick(env,'AI_BASE_URL',bailian?'BAILIAN_BASE_URL':null,bailian?BAILIAN_BASE:'')
  let url
  try {
    url=new URL(base)
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(url.port&&url.port!=='443')||
      /%|\\/.test(base)||/\/(?:chat\/completions|responses)\/?$/.test(url.pathname))throw Error()
    if(bailian){if(!BAILIAN_HOST.test(url.hostname))throw Error()}
    else {
      const hosts=pick(env,'AI_ALLOWED_HOSTS',null).split(',').map(h=>h.trim().toLowerCase()).filter(Boolean)
      if(!hosts.length||hosts.some(h=>!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/.test(h)||h.endsWith('.localhost')||h.endsWith('.local'))||!hosts.includes(url.hostname))throw Error()
    }
  }catch{return invalid('ai_base_url','AI接口地址不合适：需HTTPS服务端地址及匹配的服务商域名，不填写完整请求路径。')}
  return {ok:true,config:{provider,apiStyle,apiKey,model,baseUrl:url.href.replace(/\/+$/,'')}}
}
