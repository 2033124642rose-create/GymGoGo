// Read-only administrator endpoint. There is deliberately no public reset endpoint.
export async function onRequest({request,env}){
  const deny=()=>Response.json({error:'forbidden'},{status:403,headers:{'Cache-Control':'no-store'}})
  const token=env.QUIZ_ADMIN_TOKEN||'',given=request.headers.get('Authorization')||''
  if(request.method!=='GET'||token.length<32||given!=='Bearer '+token||!env.QUIZ_SERVICE)return deny()
  const source=request.headers.get('CF-Connecting-IP');if(!source)return deny()
  try{return await env.QUIZ_SERVICE.fetch(new Request('https://quiz.internal/api/quiz/admin-status',{headers:{Authorization:given,'X-Verified-Source':source}}))}
  catch{return Response.json({error:'store_unavailable'},{status:503})}
}
