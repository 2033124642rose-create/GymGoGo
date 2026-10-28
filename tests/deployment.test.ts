// @vitest-environment node
import {it,expect,vi} from 'vitest'
import {createReviewService} from '../server/review.mjs'
import handler from '../api/review.mjs'
it('public mode never calls a model even when a server key exists',async()=>{
 const fetchImpl=vi.fn();const service=createReviewService({env:{DASHSCOPE_API_KEY:'test-key'},fetchImpl,publicMode:true})
 const result=await service.evaluate({roundId:'public-round-123',count:10,seconds:75,mode:'real'})
 expect(result).toMatchObject({source:'local',notice:expect.stringContaining('公网 AI 暂未开放')});expect(fetchImpl).not.toHaveBeenCalled()
})
it('Vercel request.body adapter works without Vite or a local proxy',async()=>{
 const req={method:'POST',headers:{host:'gym.example','content-type':'application/json'},body:{roundId:'public-round-456',count:10,seconds:75,mode:'real'}}
 let body='';const res={statusCode:0,setHeader:vi.fn(),end:(value:string)=>body=value}
 await handler(req,res);expect(res.statusCode).toBe(200);expect(JSON.parse(body).source).toBe('local')
})
