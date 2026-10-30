export async function onRequest({request,env}){
  const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}})
  const url=new URL(request.url),route=url.pathname.split('/').at(-1)
  if(!['status','party','question','judge','state','advance','retry','close'].includes(route))return json({error:'not_found'},404)
  if(env.PUBLIC_AI_ENABLED!=='true'||!env.QUIZ_SERVICE)return json(route==='status'?{enabled:false,notice:'AI知识挑战暂未启用，纯运动模式仍可使用。'}:{error:'disabled'},route==='status'?200:503)
  if(request.method!==(route==='status'?'GET':'POST'))return json({error:'method_not_allowed'},405)
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return json({error:'origin'},403)
  // CF-Connecting-IP is supplied by Cloudflare, not an application-provided X-Forwarded-For.
  const source=request.headers.get('CF-Connecting-IP')
  if(!source)return json({error:'source_unavailable'},403)
  const headers=new Headers({'X-Verified-Source':source,'Content-Type':request.headers.get('Content-Type')||''})
  const token=request.headers.get('X-Party-Token');if(token)headers.set('X-Party-Token',token)
  try{
    // Bound bodies before crossing the service binding, with no automatic retries.
    let body
    if(request.method==='POST'){
      const reader=request.body?.getReader();if(!reader)return json({error:'invalid_request'},400)
      let size=0;const chunks=[]
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return json({error:'too_large'},413)}chunks.push(value)}
      body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}
    }
    return await env.QUIZ_SERVICE.fetch(new Request('https://quiz.internal/api/quiz/'+route,{method:request.method,headers,body}))
  }catch{return json({error:'store_unavailable'},503)}
}
