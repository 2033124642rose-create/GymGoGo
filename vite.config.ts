import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createReviewService } from './server/review.mjs'

export default defineConfig(({mode})=>{
  const service=createReviewService({env:{...process.env,...loadEnv(mode,process.cwd(),'')}})
  return {plugins:[react(),{name:'gymgogo-local-review',configureServer(server){
    server.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]==='/api/review'){void service.handler(req,res);return}
      next()
    })
  }}]}
})
