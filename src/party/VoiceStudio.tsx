import {useEffect,useRef,useState} from 'react'
import {QuizSpeech} from './QuizSpeech'
import {availableVoices,chooseVoice} from './voiceProfiles'
import type {VoiceProfiles,VoiceRole} from './voiceProfiles'
const roles:VoiceRole[]=['success','host','monster']
const labels={success:'欢快活泼型',host:'自然主持型',monster:'调皮搞怪型'}
const samples={success:'Bingo！',host:'下一位勇者，请上场！',monster:'哎呀，你们这支小队，还真有两下子！'}
export default function VoiceStudio({profiles,onChange,recording,onRecording,onClose}:{profiles:VoiceProfiles;onChange:(v:VoiceProfiles)=>void;recording:string;onRecording:(v:string)=>void;onClose:()=>void}){
 const [voices,setVoices]=useState(availableVoices),[status,setStatus]=useState('请选择声音后试听；风格名称不是音质保证。')
 const player=useRef(new QuizSpeech()),panel=useRef<HTMLElement>(null)
 useEffect(()=>{const update=()=>setVoices(availableVoices());update();window.speechSynthesis?.addEventListener?.('voiceschanged',update)
  const previous=document.activeElement as HTMLElement|null;panel.current?.focus()
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose()}if(e.key==='Tab'){
   const list=panel.current?.querySelectorAll<HTMLElement>('button,input,select');if(!list?.length)return
   const first=list[0],last=list[list.length-1];if(document.activeElement===panel.current||(!e.shiftKey&&document.activeElement===last)){e.preventDefault();first.focus()}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  }};window.addEventListener('keydown',key,true)
  return()=>{player.current.cancel();window.speechSynthesis?.removeEventListener?.('voiceschanged',update);window.removeEventListener('keydown',key,true);previous?.focus()}
 },[onClose])
 function preview(role:VoiceRole){player.current.cancel();setStatus('正在试听：'+labels[role]);void player.current.play(samples[role],true,setStatus,{...profiles[role],role,...(role==='success'?{audioSrc:recording}:{})}).then(done=>{if(done)setStatus(old=>old.startsWith('正在试听')?'试听结束，请按听感选择。':old)})}
 return <div className="party-quiz-overlay"><section ref={panel} tabIndex={-1} className="party-quiz-panel voice-studio" role="dialog" aria-modal="true" aria-labelledby="voice-studio-title"><h2 id="voice-studio-title">派对声音工坊</h2><p>不调用AI、不使用麦克风，不上传录音。仅选择设备本地语音。</p>
 {roles.map(role=><fieldset key={role}><legend>{labels[role]}</legend><label>声音<select aria-label={labels[role]+'声音'} value={profiles[role].voiceURI} onChange={e=>{player.current.cancel();onChange({...profiles,[role]:{...profiles[role],voiceURI:e.target.value}})}}><option value="">自动本地{role==='success'?'英文优先':'中文优先'}</option>{voices.filter(v=>v.localService).map((v,i)=><option key={v.voiceURI+'-'+i} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label><small>当前将使用：{chooseVoice(voices,role,profiles[role].voiceURI)?.name||'没有合适的本地语音'}</small>
 <label>语速 {profiles[role].rate.toFixed(2)}<input aria-label={labels[role]+'语速'} type="range" min="0.7" max="1.25" step="0.01" value={profiles[role].rate} onChange={e=>onChange({...profiles,[role]:{...profiles[role],rate:Number(e.target.value)}})}/></label>
 <label>音调 {profiles[role].pitch.toFixed(2)}<input aria-label={labels[role]+'音调'} type="range" min="0.6" max="1.5" step="0.01" value={profiles[role].pitch} onChange={e=>onChange({...profiles,[role]:{...profiles[role],pitch:Number(e.target.value)}})}/></label><button onClick={()=>preview(role)}>试听{labels[role]}</button></fieldset>)}
 <label>导入真人 Bingo 录音（本地文件，最多2MB，建议1–3秒）<input aria-label="真人Bingo录音" type="file" accept="audio/*" onChange={e=>{player.current.cancel();const f=e.target.files?.[0];if(!f)return;if(f.size>2*1024*1024||!f.type.startsWith('audio/')){setStatus('请选择2MB以内的音频文件。');return}onRecording(URL.createObjectURL(f));setStatus('已导入本地录音，试听欢快活泼型即可播放；刷新后需重新导入。')}}/></label>
 {recording&&<button onClick={()=>{player.current.cancel();onRecording('')}}>移除Bingo录音</button>}
 <p role="status">{status}</p><details><summary>查看此浏览器实际语音列表（{voices.length}）</summary><ul>{voices.map((v,i)=><li key={i}>{v.name} · {v.lang} · {v.localService?'本地':'在线，当前不启用'}</li>)}</ul></details>
 <div className="quiz-actions"><button onClick={()=>{player.current.cancel();setStatus('试听已停止。')}}>停止试听</button><button onClick={onClose}>保留当前选择并返回</button></div></section></div>
}
