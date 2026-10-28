// Cloudflare Pages public MVP: no provider imports, credentials or outbound model calls.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
export async function onRequest({request}){
 if(request.method!=='POST')return json({error:'method_not_allowed'},405)
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'origin'},403)
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'content_type'},415)
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:'invalid_request'},400)
  let size=0;const chunks=[]
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return json({error:'too_large'},413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const input=JSON.parse(new TextDecoder().decode(bytes))
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['roundId','count','seconds','mode'].includes(k))||typeof input.roundId!=='string'||!/^[-a-zA-Z0-9]{12,80}$/.test(input.roundId)||input.count!==10||input.mode!=='real'||!Number.isInteger(input.seconds)||input.seconds<0||input.seconds>86400)return json({error:'invalid_round'},400)
  return json({source:'local',title:'萌芽森林破关者',review:`本局完成 ${input.count} 次动作，用时 ${input.seconds} 秒，贪睡团子已被击败。这是本地备用战报，公网 AI 尚未开放。`,notice:'公网 AI 暂未开放，当前为本地备用战报，不产生模型调用'})
 }catch{return json({error:'invalid_request'},400)}
}
