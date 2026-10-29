import React, {useLayoutEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import HatOverlay from '../src/ar/HatOverlay'
import type {HatOverlayHandle} from '../src/ar/HatOverlay'
import {HATS,HAT_IDS} from '../src/ar/hats'
import type {HatId} from '../src/ar/hats'
import {locateHat} from '../src/ar/headTracking'
import {headFrame} from './hat-fixtures'

function Harness(){
  const overlay=useRef<HatOverlayHandle>(null),time=useRef(0)
  const [hat,setHat]=useState<HatId>('crown'),[dx,setDx]=useState(0),[dy,setDy]=useState(0)
  const [roll,setRoll]=useState(0),[scale,setScale]=useState(1),[missing,setMissing]=useState(false)
  const [wide,setWide]=useState(false),[player,setPlayer]=useState('test-player-1')
  const width=wide?1280:640,height=wide?720:480
  const frame=headFrame(time.current+100,dx,dy,scale,roll,width,height)
  if(missing)frame.landmarks=[]
  const raw=locateHat(frame.landmarks,width,height)
  useLayoutEffect(()=>{const feed=()=>{time.current+=80;overlay.current?.update({...frame,timestamp:time.current},width,height)};feed();const timer=setInterval(feed,80);return()=>clearInterval(timer)},[hat,dx,dy,roll,scale,missing,wide,player])
  const centerX=(.5+dx)*width,centerY=(.35+dy)*height
  return <main><style>{`body{margin:0;background:#14271d;color:#e5efc8;font:16px system-ui}main{max-width:960px;margin:24px auto;padding:0 20px}h1{font-size:25px}p{line-height:1.7}button,select{font:inherit;background:#3b5538;color:#edf4c8;border:1px solid #a6c178;border-radius:9px;padding:8px 11px;margin:4px}.stage{position:relative;max-width:720px;margin:15px auto;border:2px solid #9ebd74;border-radius:18px;background:repeating-linear-gradient(45deg,#273f2e,#273f2e 25px,#2d4733 25px,#2d4733 50px);overflow:hidden}.head{position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1)}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.readout{padding:8px;background:#273c2a;border-radius:10px}`}</style>
  <h1>派对 AR 帽子 · 本地合成坐标测试</h1><p>只有示意头像和合成关键点，没有开启摄像头、运行模型或上传影像。用于核对素材、镜像、移动、歪头和缩放；不代表真人佩戴效果。</p>
  <div className="controls"><label>帽子<select aria-label="测试帽子" value={hat} onChange={e=>setHat(e.target.value as HatId)}>{HAT_IDS.map(id=><option key={id} value={id}>{HATS[id].name}</option>)}</select></label>
  <button onClick={()=>setDx(x=>x-.05)}>源画面向左</button><button onClick={()=>setDx(x=>x+.05)}>源画面向右</button><button onClick={()=>setDy(y=>y-.05)}>上移</button><button onClick={()=>setRoll(r=>r+15)}>歪头15度</button><button onClick={()=>setScale(s=>s+.15)}>放大</button><button onClick={()=>setMissing(v=>!v)}>{missing?'恢复头部':'丢失头部'}</button><button onClick={()=>{setPlayer(p=>p==='test-player-1'?'test-player-2':'test-player-1');setHat(h=>h==='crown'?'pirate':'crown')}}>换玩家</button><button onClick={()=>setWide(v=>!v)}>切换画幅</button></div>
  <div className="stage" style={{aspectRatio:width/height}}><svg className="head" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">{!missing&&<><ellipse cx={centerX} cy={centerY+24*scale} rx={width*.07*scale} ry={height*.125*scale} fill="#d8dca8" stroke="#6c8c61" strokeWidth="4"/>{[2,5].map(id=><circle key={id} cx={frame.landmarks[id].x*width} cy={frame.landmarks[id].y*height} r="4" fill="#325b45"/>)}</>}</svg><HatOverlay ref={overlay} hat={hat} playerId={player}/></div>
  <p className="readout">{raw?`源坐标 x=${raw.x.toFixed(1)} y=${raw.y.toFixed(1)} · 宽度=${raw.width.toFixed(1)} · 倾斜=${raw.angle.toFixed(1)}°`:'头部丢失：帽子应隐藏'} · 此视图与视频一样镜像显示。</p></main>
}
createRoot(document.getElementById('root')!).render(<Harness/> )
