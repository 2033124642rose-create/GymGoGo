import type { Point,PoseFrame } from '../camera/pose'

export const SQUAT_RULES={calibrationMs:400,holdMs:150,minRepMs:450,maxRepMs:20000,maxFrameGapMs:700,
  minVisibility:.45,hipDown:.12,hipUp:.05,angleDown:18,angleUp:8,cooldownMs:300} as const
export type SquatPhase='calibrating'|'standing'|'bottom'|'complete'
interface Motion {height:number;left:number|null;right:number|null;confidence:number}
export interface SquatResult {phase:SquatPhase;count:number;rep:boolean;message:string;kneeAngle:number|null}
export function jointAngle(a:Point,b:Point,c:Point):number|null {
  if([a,b,c].some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))return null
  const u=[a.x-b.x,a.y-b.y,a.z!-b.z!],v=[c.x-b.x,c.y-b.y,c.z!-b.z!]
  const size=Math.hypot(...u)*Math.hypot(...v)
  if(size<.0025)return null
  return Math.acos(Math.max(-1,Math.min(1,u.reduce((sum,x,i)=>sum+x*v[i],0)/size)))*180/Math.PI
}
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
const visible=(p:Point|undefined)=>!!p&&[p.x,p.y].every(Number.isFinite)&&(p.visibility??0)>=SQUAT_RULES.minVisibility&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1
// One visible body side is enough. World angles are optional; hip motion needs only image landmarks.
function measure(frame:PoseFrame):Motion|null {
  const p=frame.landmarks,w=frame.worldLandmarks,sides: {height:number;angle:number|null;confidence:number;side:number}[]=[]
  for(const [shoulder,hip,knee,ankle,side] of [[11,23,25,27,0],[12,24,26,28,1]]){
    if(![shoulder,hip,ankle].every(i=>visible(p[i])))continue
    const torso=Math.hypot(p[hip].x-p[shoulder].x,p[hip].y-p[shoulder].y)
    if(torso<.05||p[ankle].y<=p[hip].y)continue
    const angle=visible(p[knee])?jointAngle(w[hip],w[knee],w[ankle]):null
    sides.push({height:(p[ankle].y-p[hip].y)/torso,angle,confidence:Math.min(...[shoulder,hip,ankle].map(i=>p[i].visibility??0)),side})
  }
  if(!sides.length)return null
  return {height:median(sides.map(x=>x.height)),left:sides.find(x=>x.side===0)?.angle??null,right:sides.find(x=>x.side===1)?.angle??null,confidence:Math.max(...sides.map(x=>x.confidence))}
}
export class SquatCounter {
  private phase:SquatPhase='calibrating'
  private count=0
  private baseline:Motion|null=null
  private history:Motion[]=[]
  private lastTimestamp=-Infinity
  private gateSince:number|null=null
  private gateFrames=0
  private cycleSince=0
  private lastRep=-Infinity
  private signal:'hip'|'angle'|null=null
  private message='自然站立片刻，建立本局参考姿态'
  private hipDrop=0
  private angleDrop=0
  private peakHip=0
  private peakAngle=0
  private frames=0
  private events:string[]=[]
  constructor(private target=10){}
  getState(){return this.result()}
  diagnostics(){return {...this.result(),hipDrop:this.hipDrop,angleDrop:this.angleDrop,peakHip:this.peakHip,peakAngle:this.peakAngle,
    referenceHeight:this.baseline?.height??null,signal:this.signal,frames:this.frames,confidence:this.history.at(-1)?.confidence??0,events:[...this.events]}}
  private log(text:string){if(this.events.at(-1)!==text){this.events.push(text);if(this.events.length>10)this.events.shift()}}
  private result(rep=false):SquatResult {
    const latest=this.history.at(-1),angles=[latest?.left,latest?.right].filter((x):x is number=>typeof x==='number')
    return {phase:this.phase,count:this.count,rep,message:this.message,kneeAngle:angles.length?Math.round(Math.max(...angles)):null}
  }
  reset(){this.count=0;this.lastTimestamp=-Infinity;this.lastRep=-Infinity;this.frames=0;this.peakHip=0;this.peakAngle=0;this.events=[];this.disarm('自然站立片刻，建立本局参考姿态')}
  // Opportunistic reference from the end of countdown; no absolute knee-angle requirement.
  acceptReadyBaseline(frame:PoseFrame){
    if(this.count||this.phase!=='calibrating'||!Number.isFinite(frame.timestamp))return false
    const current=measure(frame);if(!current)return false
    this.baseline=current;this.history=[current];this.lastTimestamp=frame.timestamp;this.phase='standing';this.message='准备好了，蹲下再起立即可';this.clearGate();return true
  }
  interrupt(message='计数暂停：请回到镜头内，自然站立片刻'){this.disarm(message);return this.result()}
  private clearGate(){this.gateSince=null;this.gateFrames=0}
  private disarm(message:string){this.phase=this.count>=this.target?'complete':'calibrating';this.baseline=null;this.history=[];this.signal=null;this.clearGate();this.hipDrop=0;this.angleDrop=0;this.message=message;this.log(message)}
  private held(condition:boolean,time:number,duration:number,frames=2){
    if(!condition){this.clearGate();return false}
    this.gateSince??=time;this.gateFrames++
    return time-this.gateSince>=duration&&this.gateFrames>=frames
  }
  update(frame:PoseFrame):SquatResult {
    const time=frame.timestamp
    if(!Number.isFinite(time)||time<=this.lastTimestamp||this.phase==='complete')return this.result()
    const gap=time-this.lastTimestamp;this.lastTimestamp=time;this.frames++
    if(Number.isFinite(gap)&&gap>SQUAT_RULES.maxFrameGapMs)this.disarm('识别不连续，暂停本次动作；自然站立后继续')
    const raw=measure(frame)
    if(!raw){this.disarm('关节不清晰，计数暂停：请让至少一侧肩、髋和脚踝入镜');return this.result()}
    this.history.push(raw);if(this.history.length>3)this.history.shift()
    const smoothAngle=(side:'left'|'right')=>{const values=this.history.map(x=>x[side]).filter((x):x is number=>x!==null);return raw[side]!==null&&values.length?median(values):null}
    const current={...raw,height:median(this.history.map(x=>x.height)),left:smoothAngle('left'),right:smoothAngle('right')}
    if(this.phase==='calibrating'){
      const stable=this.history.length>=3&&Math.max(...this.history.map(x=>x.height))-Math.min(...this.history.map(x=>x.height))<.1
      if(this.held(stable,time,SQUAT_RULES.calibrationMs,4)){this.baseline=current;this.phase='standing';this.message='准备好了，蹲下再起立即可';this.clearGate();this.log('参考姿态已建立')}
      return this.result()
    }
    const base=this.baseline!
    // Normalizing by torso size and ankle-relative height tolerates lateral movement and image scale.
    this.hipDrop=base.height-current.height
    const changes=(['left','right'] as const).flatMap(side=>base[side]!==null&&current[side]!==null?[base[side]!-current[side]!]:[])
    this.angleDrop=changes.length?Math.max(...changes):0
    this.peakHip=Math.max(this.peakHip,this.hipDrop);this.peakAngle=Math.max(this.peakAngle,this.angleDrop)
    if(this.phase==='standing'){
      // A taller neutral stance refines the reference without counting a mere initial rise.
      if(this.hipDrop<-.08){this.baseline=current;this.clearGate();return this.result()}
      const down=this.hipDrop>=SQUAT_RULES.hipDown||this.angleDrop>=SQUAT_RULES.angleDown
      if(time-this.lastRep>=SQUAT_RULES.cooldownMs&&this.held(down,time,SQUAT_RULES.holdMs)){
        this.signal=this.hipDrop>=SQUAT_RULES.hipDown?'hip':'angle';this.phase='bottom';this.cycleSince=time
        this.message='检测到下蹲，请起立';this.clearGate();this.log(`检测到下蹲（${this.signal==='hip'?'髋部下降':'膝角变化'}）`)
      }else if(this.count===0)this.message='准备好了，蹲下再起立即可'
    }else if(this.phase==='bottom'){
      if(time-this.cycleSince>SQUAT_RULES.maxRepMs){this.disarm('本次动作停留较久，重新建立参考后继续');return this.result()}
      const up=this.signal==='hip'?this.hipDrop<=SQUAT_RULES.hipUp:changes.length>0&&this.angleDrop<=SQUAT_RULES.angleUp
      this.message='检测到下蹲，请起立'
      if(this.held(up,time,SQUAT_RULES.holdMs)&&time-this.cycleSince>=SQUAT_RULES.minRepMs){
        this.count++;this.lastRep=time;this.phase=this.count>=this.target?'complete':'standing';this.signal=null;this.baseline=current
        this.clearGate();this.message=this.phase==='complete'?'完成 10 次，挑战通关！':'成功！+1';this.log(`成功！+1（累计 ${this.count}）`)
        return this.result(true)
      }
    }
    return this.result()
  }
}
