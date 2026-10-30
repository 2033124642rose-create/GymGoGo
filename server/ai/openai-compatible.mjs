// Protocol adapter only: game prompts, result validation, deduplication and budgets stay with callers.
export async function openAICompatibleJSON(config,input,{fetchImpl,signal}) {
  const body={model:config.model,max_tokens:input.maxTokens,temperature:input.temperature,
    response_format:{type:'json_object'},messages:input.messages,
    ...(config.provider==='bailian'?{enable_thinking:false}:{})}
  const response=await fetchImpl(config.baseUrl+'/chat/completions',{
    method:'POST',redirect:'manual',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.apiKey}`},signal,body:JSON.stringify(body)})
  const reader=response.body?.getReader()
  if(!reader&&response.ok)throw Error('model_format')
  let size=0
  const chunks=[]
  while(reader){const {done,value}=await reader.read();if(done)break;size+=value.byteLength
    if(size>32000){await reader.cancel();throw Error('model_format')}chunks.push(Buffer.from(value))}
  let envelope
  try{envelope=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{
    if(response.ok)throw Error('model_format')
  }
  if(!response.ok){
    const candidate=envelope?.error?.code||envelope?.code
    const providerCode=typeof candidate==='string'&&/^[A-Za-z0-9_.-]{1,32}$/.test(candidate)&&!candidate.includes('sk-')&&!candidate.includes(config.apiKey)?candidate:''
    throw Object.assign(Error(response.status===403?'model_forbidden':response.status===429?'model_busy':'model_unavailable'),{status:response.status,providerCode})
  }
  const content=envelope?.choices?.[0]?.message?.content
  if(typeof content!=='string')throw Error('model_format')
  try{return JSON.parse(content)}catch{throw Error('model_format')}
}
