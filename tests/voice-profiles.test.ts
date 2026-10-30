import {describe,expect,it} from 'vitest'
import {chooseVoice,speechParts} from '../src/party/voiceProfiles'
const voices=[{voiceURI:'zh',name:'本地中文',lang:'zh-CN',localService:true},{voiceURI:'en',name:'Local English',lang:'en-US',localService:true},{voiceURI:'remote',name:'Online Natural',lang:'zh-CN',localService:false}] as SpeechSynthesisVoice[]
describe('device voice profiles without assuming identical devices',()=>{
 it('uses local English for Bingo and local Chinese for the host and monster unless selected',()=>{
  expect(chooseVoice(voices,'success')?.voiceURI).toBe('en');expect(chooseVoice(voices,'host')?.voiceURI).toBe('zh')
  expect(chooseVoice(voices,'monster','en')?.voiceURI).toBe('en')
 })
 it('never silently selects an online voice and reports missing local voices honestly',()=>{
  expect(chooseVoice([voices[2]],'host','remote')).toBeUndefined();expect(chooseVoice([],'success')).toBeUndefined()
 })
 it('adds natural boundaries without dropping or inventing any AI words',()=>{
  const line='哎呀，你们这支小队有两下子！这次我先撤退，下次再战。'
  const parts=speechParts(line);expect(parts.join('')).toBe(line);expect(parts.length).toBeGreaterThan(1)
  expect(speechParts('字'.repeat(80)).every(s=>Array.from(s).length<=36)).toBe(true)
 })
})
