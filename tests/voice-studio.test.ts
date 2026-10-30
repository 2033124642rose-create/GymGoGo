import {createElement} from 'react'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import VoiceStudio from '../src/party/VoiceStudio'
import {DEFAULT_VOICES} from '../src/party/voiceProfiles'
let spoken:SpeechSynthesisUtterance[]=[]
beforeEach(()=>{
 spoken=[]
 vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(public text:string){}})
 vi.stubGlobal('speechSynthesis',{getVoices:()=>[{name:'Local Chinese',voiceURI:'zh',lang:'zh-CN',localService:true},{name:'Local English',voiceURI:'en',lang:'en-US',localService:true},{name:'Online Chinese',voiceURI:'remote',lang:'zh-CN',localService:false}],speak:vi.fn(u=>spoken.push(u)),cancel:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()})
 vi.stubGlobal('fetch',vi.fn())
})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function setup(){const onChange=vi.fn(),onClose=vi.fn();render(createElement(VoiceStudio,{profiles:structuredClone(DEFAULT_VOICES),onChange,onClose,recording:'',onRecording:vi.fn()}));return{onChange,onClose}}
describe('voice workshop without camera or AI',()=>{
 it('offers three styles, enumerates local voices, and previews Bingo using English when present',()=>{
  setup();expect(screen.getByLabelText('欢快活泼型声音')).toBeTruthy();expect(screen.getByLabelText('自然主持型声音')).toBeTruthy()
  expect(screen.getByLabelText('调皮搞怪型声音')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'试听欢快活泼型'}))
  expect(spoken[0].text).toBe('Bingo！');expect(spoken[0].voice.lang).toBe('en-US');expect(fetch).not.toHaveBeenCalled()
 })
 it('changes only the selected role and lets the user stop or cancel the preview',()=>{
  const s=setup();fireEvent.change(screen.getByLabelText('调皮搞怪型声音'),{target:{value:'zh'}})
  expect(s.onChange.mock.calls[0][0].monster.voiceURI).toBe('zh');expect(s.onChange.mock.calls[0][0].host).toEqual(DEFAULT_VOICES.host)
  fireEvent.click(screen.getByRole('button',{name:'试听调皮搞怪型'}));fireEvent.click(screen.getByRole('button',{name:'停止试听'}))
  expect(window.speechSynthesis.cancel).toHaveBeenCalled();expect(screen.getByRole('status').textContent).toBe('试听已停止。')
  fireEvent.keyDown(window,{key:'Escape'});expect(s.onClose).toHaveBeenCalledTimes(1)
 })
 it('shows online voices as unavailable for selection and supports local recording input only',()=>{
  setup();expect(screen.getByText(/Online Chinese.*在线/)).toBeTruthy()
  expect(screen.queryByRole('option',{name:/Online Chinese/})).toBeNull()
  expect(screen.getByLabelText('真人Bingo录音').getAttribute('accept')).toBe('audio/*')
  expect(fetch).not.toHaveBeenCalled()
 })
})
