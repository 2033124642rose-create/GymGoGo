import { findLocalChineseVoice } from '../camera/trainingFeedback'
import {availableVoices,chooseVoice,speechParts} from './voiceProfiles'
import type {VoiceRole,VoiceProfile} from './voiceProfiles'
export interface SpeechOptions extends Partial<VoiceProfile>{role?:VoiceRole;audioSrc?:string}
// Local device voices/recordings only: never synthesize through a provider API.
export class QuizSpeech {
 private stop:(()=>void)|null=null
 play(text:string,enabled:boolean,notice:(message:string)=>void,options:SpeechOptions={}):Promise<boolean>{
  this.cancel()
  return new Promise(resolve=>{
   let done=false,u:SpeechSynthesisUtterance|undefined,audio:HTMLAudioElement|undefined
   let timer:ReturnType<typeof setTimeout>|undefined,total:ReturnType<typeof setTimeout>|undefined,pause:ReturnType<typeof setTimeout>|undefined
   const finish=(complete:boolean)=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(total);clearTimeout(pause);this.stop=null
    if(audio){audio.onended=null;audio.onerror=null;audio.pause()}
    if(u){u.onend=null;u.onerror=null;u.onstart=null;window.speechSynthesis?.cancel()}resolve(complete)}
   this.stop=()=>finish(false)
   const fallback=(message:string)=>{if(done)return;notice(message);clearTimeout(timer);timer=setTimeout(()=>finish(true),700)}
   const speak=()=>{
    if(done)return
    try{
     const voice=enabled&&typeof window.SpeechSynthesisUtterance!=='undefined'?options.role?chooseVoice(availableVoices(),options.role,options.voiceURI):findLocalChineseVoice(window.speechSynthesis?.getVoices()||[]):undefined
     if(!voice){fallback(enabled?'没有合适的本地语音；文字反馈保留，可在声音工坊导入真人Bingo录音。':'语音已关闭，文字反馈保留。');return}
     const parts=options.role==='monster'?speechParts(text):[text];let index=0
     const next=()=>{if(done)return;if(index>=parts.length){finish(true);return}
      u=new SpeechSynthesisUtterance(parts[index++]);u.voice=voice;u.lang=voice.lang
      u.rate=Math.max(.7,Math.min(1.25,options.rate??(text==='Bingo！'?1.15:1.05)));u.pitch=Math.max(.6,Math.min(1.5,options.pitch??(text==='Bingo！'?1.3:1)))
      u.onend=()=>{clearTimeout(timer);pause=setTimeout(next,index<parts.length?150:0)}
      u.onerror=()=>fallback('语音播放失败，文字反馈保留；游戏正常继续。')
      u.onstart=()=>{clearTimeout(timer);timer=setTimeout(()=>{fallback('语音播放超时，游戏正常继续。');window.speechSynthesis?.cancel()},8000)}
      timer=setTimeout(()=>{fallback('浏览器未启动语音，文字反馈保留。');window.speechSynthesis?.cancel()},2500)
      window.speechSynthesis.speak(u)
     }
     total=setTimeout(()=>finish(true),15000);next()
    }catch{fallback('浏览器语音不可用，文字反馈保留。')}
   }
   if(enabled&&options.role==='success'&&options.audioSrc&&(options.audioSrc.startsWith('blob:')||options.audioSrc.startsWith('/audio/'))){
    try{audio=new Audio(options.audioSrc);let recovered=false
     const recover=()=>{if(done||recovered)return;recovered=true;clearTimeout(timer);audio!.onended=null;audio!.onerror=null;audio!.pause();notice('真人录音未能播放，改用本地语音。');speak()}
     audio.onended=()=>finish(true);audio.onerror=recover;timer=setTimeout(recover,6000);void audio.play().catch(recover)
    }catch{speak()}
   }else speak()
  })
 }
 cancel(){this.stop?.()}
}
