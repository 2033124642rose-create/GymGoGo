import { ForestBackdrop, Monster } from '../game/ForestScene'
import type { PartyLevel } from './levels'

export function PartyBackdrop({theme}:{theme:PartyLevel['theme']}) {
  if(theme==='forest') return <ForestBackdrop/>
  return <svg className="forest-backdrop" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
    {theme==='mist' ? <><path d="M0 320q130-120 260 0t260-15 260 0 220-20v115H0Z" fill="#605779" opacity=".35"/><path d="M0 220q180-60 350 20t350-10 300 20M0 290q200-50 400 10t600-10" fill="none" stroke="#c8badf" strokeWidth="28" opacity=".1"/><path d="m100 350 30-190 25 190m650 0 25-230 30 230" fill="#535169" opacity=".4"/></> : <><path d="M60 350V140h35v-35h35v35h35v-35h35v245m600 0V140h-35v-35h-35v35h-35v-35h-35v245" fill="#46505b" opacity=".65"/><path d="M230 360V210h45v-40h45v40h45v-40h45v190m180 0V210h45v-40h45v40h45v-40h45v190" fill="#52606a" opacity=".3"/><path d="m85 95 45-70 45 70m650 0-45-70-45 70" fill="#ae856d" opacity=".45"/></>}
    <ellipse cx="500" cy="365" rx="450" ry="55" fill={theme==='mist'?'#302e49':'#263540'}/>
  </svg>
}
export default function PartyMonster({level,hit,defeated,count,total}:{level:PartyLevel;hit:boolean;defeated:boolean;count:number;total:number}) {
  const damageCount=Math.min(10,Math.ceil(count/total*10))
  const label=`${level.monster}，受到 ${count} 次真实攻击`
  if(level.visual==='slime')return <Monster hit={hit} defeated={defeated} damageCount={damageCount} label={label}/>
  const ghost=level.visual==='ghost'
  return <svg key={level.id} className={`monster ${hit?'monster-hit':''} ${defeated?'monster-defeated':''}`} viewBox="0 0 440 370" role="img" aria-label={label}>
    <ellipse cx="220" cy="330" rx="118" ry="18" fill="#101c22" opacity=".3"/>
    <g key={count} className="monster-body" strokeLinecap="round" strokeLinejoin="round">
      {ghost ? <><path d="M112 290V175q0-93 108-93t108 93v115l-34-16-36 24-37-19-38 19-36-24Z" fill="#ded8ef" stroke="#a89cc9" strokeWidth="5"/><path d="M117 207q-63 0-60 44 26 10 58-13m209-31q62 0 59 44-26 10-57-13" fill="#c8bedf" stroke="#a89cc9" strokeWidth="4"/><path d="M165 118q35-24 71-15" fill="none" stroke="#f6f1ff" strokeWidth="10" opacity=".7"/><path d="M150 284q70 24 140 0" fill="none" stroke="#beb1d6" strokeWidth="7" opacity=".5"/></> : <><path d="M139 200Q40 70 34 191q18 5 29 29 15-18 34-9l22 41m182-52Q400 70 406 191q-18 5-29 29-15-18-34-9l-22 41" fill="#8b8fa6" stroke="#485761" strokeWidth="5"/><path d="m123 246-38 35-31-15 10 50q65 3 97-25" fill="#73978b" stroke="#42655e" strokeWidth="5"/><path d="M115 183q-9-79 105-87 115 7 105 87l21 98q0 45-126 43-126 2-126-43Z" fill="#84b99b" stroke="#477a65" strokeWidth="5"/><path d="m141 123-14-63 54 42m78 0 54-42-14 63" fill="#e4d4a3" stroke="#8d8c6a" strokeWidth="4"/><path d="m201 100 20-33 20 34" fill="#bad48f"/><ellipse cx="220" cy="271" rx="67" ry="42" fill="#e4dca9"/><path d="m177 260 16 9m-8 13 16 9m62-31-16 9m8 13-16 9" stroke="#bdba85" strokeWidth="4"/><path d="M180 316v11m80-11v11" stroke="#e7ddb4" strokeWidth="8"/></>}
      <ellipse cx="172" cy="184" rx="28" ry="33" fill="#fffbed"/><ellipse cx="268" cy="184" rx="28" ry="33" fill="#fffbed"/>
      {defeated ? <path d="m160 175 22 18m0-18-22 18m96-18 22 18m0-18-22 18" fill="none" stroke="#44475c" strokeWidth="6"/> : <><ellipse cx="176" cy="190" rx="12" ry="17" fill="#3f4654"/><ellipse cx="264" cy="190" rx="12" ry="17" fill="#3f4654"/><circle cx="180" cy="184" r="4" fill="white"/><circle cx="268" cy="184" r="4" fill="white"/></>}
      <path d={damageCount>=6?'m198 232 11-7 11 7 11-7 11 7':'M199 222q21 25 42 0'} fill="none" stroke="#575364" strokeWidth="5"/>
      <ellipse cx="144" cy="220" rx="15" ry="7" fill="#e7a3af" opacity=".6"/><ellipse cx="296" cy="220" rx="15" ry="7" fill="#e7a3af" opacity=".6"/>
      {Array.from({length:Math.min(5,Math.ceil(damageCount/2))},(_,i)=><g key={i} transform={`translate(${137+i*39} ${i%2?126:268}) rotate(${i*13})`}><path d="m-8-5 5 10m3-10 5 10" stroke={ghost?'#a48cb7':'#697e99'} strokeWidth="4"/></g>)}
    </g>
  </svg>
}
