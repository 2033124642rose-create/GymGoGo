import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createReviewService } from './server/review.mjs'
import { createQuizService } from './server/quiz.mjs'

export default defineConfig(({mode})=>{
  const env={...process.env,...loadEnv(mode,process.cwd(),'')}
  // During a budgeted quiz trial the old model-review path stays local-only, sharing no untracked calls.
  const service=createReviewService({env,publicMode:env.GYMGO_QUIZ_ENABLED==='true'})
  return {server:{watch:{ignored:['**/.local/**','**/.npm-cache/**']},fs:{deny:['.env*','**/.env*','**/.dev.vars*','**/*.{crt,pem}','**/.git/**','**/.local/**','**/.npm-cache/**','**/server/**']}},plugins:[react(),{name:'gymgogo-local-review',configureServer(server){
    const quiz=createQuizService({env})
    server.httpServer?.once('close',()=>quiz.close())
    server.middlewares.use((req,res,next)=>{
      if(req.url?.startsWith('/api/quiz/')){void quiz.handler(req,res);return}
      if(req.url?.split('?')[0]==='/api/review'){void service.handler(req,res);return}
      next()
    })
  }}]}
})
