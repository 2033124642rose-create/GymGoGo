export type VoiceRole = 'success' | 'host' | 'monster'
export interface VoiceProfile { voiceURI:string; rate:number; pitch:number }
export type VoiceProfiles = Record<VoiceRole,VoiceProfile>
export const DEFAULT_VOICES:VoiceProfiles={success:{voiceURI:'',rate:1.02,pitch:1.12},host:{voiceURI:'',rate:.98,pitch:1},monster:{voiceURI:'',rate:.94,pitch:.88}}
export function availableVoices():SpeechSynthesisVoice[]{try{return window.speechSynthesis?.getVoices().filter(v=>/^zh|^en/i.test(v.lang))||[]}catch{return []}}
export function chooseVoice(voices:SpeechSynthesisVoice[],role:VoiceRole,uri=''){
 const selected=voices.find(v=>v.voiceURI===uri&&v.localService)
 if(selected)return selected
 const language=role==='success'?/^en/i:/^zh/i
 return voices.find(v=>v.localService&&language.test(v.lang))||voices.find(v=>v.localService&&/^zh/i.test(v.lang))
}
export function speechParts(text:string){const parts:string[]=[];let part='';for(const ch of Array.from(text)){part+=ch;if(/[，。！？；,.!?;]/.test(ch)||Array.from(part).length>=36){parts.push(part);part=''}}if(part)parts.push(part);return parts}
