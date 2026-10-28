// @vitest-environment node
import {it,expect,vi} from 'vitest'
import {onRequest} from '../functions/api/review.js'
it('Pages edge endpoint provides explicit free fallback without outbound requests',async()=>{
 const spy=vi.spyOn(globalThis,'fetch')
 const request=new Request('https://gymgogo.pages.dev/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roundId:'cloudflare-test-123',count:10,seconds:75,mode:'real'})})
 const response=await onRequest({request});expect(response.status).toBe(200);expect(await response.json()).toMatchObject({source:'local',notice:expect.stringContaining('公网 AI 暂未开放')});expect(spy).not.toHaveBeenCalled();spy.mockRestore()
})
it('Pages endpoint rejects oversized and malformed requests',async()=>{
 for(const [body,status] of [['x'.repeat(2050),413],['{}',400]]){const response=await onRequest({request:new Request('https://gymgogo.pages.dev/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body})});expect(response.status).toBe(status)}
})
