import type { PoseFrame } from '../camera/pose'
import { jointAngle, SQUAT_RULES } from '../squat/SquatCounter'

export type ReadyPhase = 'idle' | 'waiting' | 'countdown' | 'active' | 'ended'
const JOINTS = [[11,'左肩'],[12,'右肩'],[23,'左髋'],[24,'右髋'],[25,'左膝'],[26,'右膝'],[27,'左踝'],[28,'右踝']] as const
export interface ReadyDebug {
  standing:boolean;reason:string;stableMs:number;left:number|null;right:number|null
  filteredLeft:number|null;filteredRight:number|null;confidence:number;weakJoint:string
  hipDrift:number|null;footDrift:number|null;resets:number;lastReset:string
  jointsValid:boolean;framingIssue:boolean;guidance:string;requiredAngle:number|null
}
export interface ReadyFailure extends ReadyDebug { timestamp:number }
const emptyDebug=():ReadyDebug=>({standing:false,reason:'尚未准备',stableMs:0,left:null,right:null,
  filteredLeft:null,filteredRight:null,confidence:0,weakJoint:'暂无',hipDrift:null,footDrift:null,resets:0,lastReset:'无',
  jointsValid:false,framingIssue:false,guidance:'请开启摄像头，让主要关节入镜',requiredAngle:null})

// Ready means continuous full-body recognition, not a posture examination.
// Actual squat validation remains in SquatCounter.
export class ReadyGate {
  phase:ReadyPhase='idle'
  digit=0
  private last=-Infinity
  private frames:PoseFrame[]=[]
  private stableFrames=0
  private stableMs=0
  private countdownMs=0
  private previousGood=false
  private softSince:number|null=null
  private debug=emptyDebug()
  private failures:ReadyFailure[]=[]
  snapshot(){return {...this.debug,stableMs:this.stableMs,phase:this.phase,digit:this.digit,failures:this.failures.map(value=>({...value}))}}
  prepare(){this.phase='waiting';this.last=-Infinity;this.failures=[];this.debug=emptyDebug();this.clear();this.debug.reason='等待全身识别'}
  private remember(reason:string,timestamp:number){
    if(this.failures.at(-1)?.reason===reason)return
    this.failures.push({...this.debug,reason,stableMs:this.stableMs,timestamp})
    if(this.failures.length>12)this.failures.shift()
  }
  stop(phase:'idle'|'ended'='idle'){this.phase=phase;this.clear();this.debug.reason=phase==='ended'?'本局结束，不自动重开':'尚未准备'}
  private clear(){
    this.frames=[];this.stableFrames=0;this.stableMs=0;this.countdownMs=0
    this.previousGood=false;this.softSince=null;this.digit=0;this.debug.standing=false
    this.debug.filteredLeft=null;this.debug.filteredRight=null;this.debug.jointsValid=false
  }
  interrupt(reason='人体识别中断，请重新入镜'){
    if(this.phase!=='waiting'&&this.phase!=='countdown')return
    this.remember(reason,this.last)
    if(this.stableFrames||this.phase==='countdown'){this.debug.resets++;this.debug.lastReset=reason}
    this.phase='waiting';this.clear();this.debug.reason=reason
  }
  stale(now:number){if(now-this.last>SQUAT_RULES.maxFrameGapMs)this.interrupt('超过 700ms 未收到新识别帧')}
  private reject(reason:string,time:number,soft=false){
    this.debug.standing=false;this.debug.reason=reason;this.remember(reason,time)
    if(soft&&this.stableFrames>0){
      this.softSince??=time;this.previousGood=false
      if(time-this.softSince<=250){this.debug.reason=`短暂波动，计时暂停：${reason}`;return}
    }
    this.interrupt(reason)
  }
  update(frame:PoseFrame|null):{start:boolean;calibration:PoseFrame[]}{
    const no={start:false,calibration:[]}
    if(this.phase!=='waiting'&&this.phase!=='countdown')return no
    if(!frame){this.interrupt('摄像头关闭或人体识别中断');return no}
    const time=frame.timestamp
    if(!Number.isFinite(time)||time<=this.last)return no
    const gap=time-this.last
    if(gap>SQUAT_RULES.maxFrameGapMs&&Number.isFinite(gap))this.interrupt('识别帧间断超过 700ms')
    this.last=time
    const p=frame.landmarks,w=frame.worldLandmarks
    this.debug.jointsValid=false;this.debug.framingIssue=false
    this.debug.guidance='保持主要关节入镜即可，无需刻意伸直膝盖或站着不动'
    this.debug.left=jointAngle(w[23],w[25],w[27]);this.debug.right=jointAngle(w[24],w[26],w[28])
    const weakest=[...JOINTS].sort((a,b)=>(p[a[0]]?.visibility??0)-(p[b[0]]?.visibility??0))[0]
    this.debug.confidence=p[weakest[0]]?.visibility??0;this.debug.weakJoint=weakest[1]
    for(const [i,name] of JOINTS){
      const point=p[i]
      if(!point||![point.x,point.y].every(Number.isFinite)){
        this.debug.framingIssue=true;this.debug.guidance='请让肩、髋、膝和双脚同时进入画面'
        this.reject(`${name}关键点丢失`,time);return no
      }
      if(point.x<=.02||point.x>=.98||point.y<=.02||point.y>=.98){
        this.debug.framingIssue=true;this.debug.guidance='调整摄像头角度或后退，让肩膀和双脚同时完整入镜'
        this.reject(`${name}出框`,time);return no
      }
    }
    if(!Number.isFinite(this.debug.confidence)||this.debug.confidence<.5){
      this.debug.framingIssue=true;this.debug.guidance='请保持主要关节可见，减少遮挡'
      this.reject(`${this.debug.weakJoint}可信度不足（需 ≥0.50）`,time,this.debug.confidence>=.4);return no
    }
    if(this.softSince!==null&&time-this.softSince>250){this.interrupt('识别波动持续超过 250ms，请重新入镜');return no}
    this.softSince=null
    const elapsed=this.previousGood&&Number.isFinite(gap)?gap:0
    this.previousGood=true;this.stableFrames++
    this.debug.jointsValid=true;this.debug.standing=true;this.debug.reason='全身识别正常（不检查站姿）'
    this.frames.push(frame);this.frames=this.frames.filter(value=>time-value.timestamp<=1000)
    if(this.phase==='waiting'){
      this.stableMs+=elapsed
      if(this.stableMs>=2000&&this.stableFrames>=6){this.phase='countdown';this.countdownMs=0;this.digit=3}
    }else{
      this.countdownMs+=elapsed;this.digit=Math.max(1,3-Math.floor(this.countdownMs/1000))
      if(this.countdownMs>=3000){this.phase='active';this.digit=0;return {start:true,calibration:this.frames}}
    }
    return no
  }
}
