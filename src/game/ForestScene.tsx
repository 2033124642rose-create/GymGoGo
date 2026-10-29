// Every hit adds a persistent cartoon mark; resetting the count clears them all.
const WOUND_MARKS = [
  { x: 132, y: 231, rotation: -22, kind: 'scratch' },
  { x: 294, y: 232, rotation: 24, kind: 'bandage' },
  { x: 181, y: 116, rotation: -15, kind: 'scratch' },
  { x: 245, y: 272, rotation: -20, kind: 'bruise' },
  { x: 116, y: 275, rotation: 25, kind: 'bandage' },
  { x: 286, y: 119, rotation: 18, kind: 'scratch' },
  { x: 185, y: 286, rotation: 20, kind: 'bandage' },
  { x: 318, y: 260, rotation: -25, kind: 'bruise' },
  { x: 217, y: 147, rotation: 12, kind: 'bandage' },
  { x: 262, y: 306, rotation: -10, kind: 'scratch' },
] as const

export function Monster({ hit, defeated, damageCount, label }: { hit: boolean; defeated: boolean; damageCount: number; label?: string }) {
  return <svg className={`monster ${hit ? 'monster-hit' : ''} ${defeated ? 'monster-defeated' : ''}`} viewBox="0 0 440 370" role="img" aria-label={label ?? `贪睡团子：已受到 ${damageCount} 次攻击，身上有 ${damageCount} 处卡通伤痕`}>
    <defs>
      <linearGradient id="body" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#dbffa6"/><stop offset=".55" stopColor="#a3de6c"/><stop offset="1" stopColor="#64aa57"/></linearGradient>
      <linearGradient id="horn" x2="0.4" y2="1"><stop stopColor="#fdf1bf"/><stop offset="1" stopColor="#d7bd7d"/></linearGradient>
      <radialGradient id="belly"><stop stopColor="#eff9bb"/><stop offset="1" stopColor="#cbe990"/></radialGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="13" stdDeviation="8" floodColor="#19232b" floodOpacity=".3"/></filter>
    </defs>
    <ellipse cx="220" cy="332" rx="115" ry="18" fill="#111321" opacity=".28"/>
    <g key={damageCount} className="monster-body" filter="url(#shadow)">
      <path d="M315 254q62 17 64-35 23 61-36 73" fill="#7dbb59" stroke="#51894b" strokeWidth="3"/>
      <path d="M130 120Q86 65 106 58q38 8 56 44M281 102q22-45 52-43 16 26-24 70" fill="url(#horn)" stroke="#a5ad68" strokeWidth="3"/>
      <ellipse cx="153" cy="310" rx="39" ry="23" fill="#7bb75a"/>
      <ellipse cx="284" cy="310" rx="39" ry="23" fill="#7bb75a"/>
      <path d="M108 172C100 97 151 79 217 84c66-9 122 29 116 97l13 75c8 50-36 65-123 64-92 2-140-18-128-66z" fill="url(#body)" stroke="#89bd64" strokeWidth="3"/>
      <path d="m196 87 16-24 15 23 16-17 10 20" fill="#b9eb86"/>
      <ellipse cx="221" cy="265" rx="67" ry="46" fill="url(#belly)" opacity=".85"/>
      <path d="M108 209q-47 4-44 43c3 15 20 8 32-8M331 205q48 1 48 38c-1 19-21 9-32-1" fill="url(#body)" stroke="#89bd64" strokeWidth="3"/>
      <ellipse cx="165" cy="179" rx="27" ry="33" fill="#f9fff0"/>
      <ellipse cx="275" cy="179" rx="27" ry="33" fill="#f9fff0"/>
      {defeated ? <g stroke="#33453e" strokeWidth="6" strokeLinecap="round"><path d="m154 179 18-12m-18 0 18 12m94 0 18-12m-18 0 18 12"/></g> : damageCount >= 7 ? <g fill="none" stroke="#33453e" strokeWidth="5" strokeLinecap="round"><path d="m157 177 20 8-20 7m121-15-20 8 20 7"/></g> : <g fill="#293b35"><ellipse cx="173" cy="184" rx="12" ry={damageCount >= 4 ? 12 : 18}/><ellipse cx="267" cy="184" rx="12" ry="18"/><g fill="white"><circle cx="177" cy="178" r="4"/><circle cx="271" cy="178" r="4"/></g></g>}
      <ellipse cx="139" cy="211" rx="19" ry="9" fill="#f5a4a2" opacity=".7"/><ellipse cx="302" cy="211" rx="19" ry="9" fill="#f5a4a2" opacity=".7"/>
      {damageCount < 4 ? <><path d="M197 214q24 27 48 0" fill="#425143" stroke="#3d5544" strokeWidth="4" strokeLinecap="round"/><path d="m202 220 7 12 7-8m15 0 7 8 5-12" fill="#fff9db"/></> : <path d={damageCount >= 7 ? 'm200 227 10-6 10 6 10-6 10 6' : 'M204 228q16-18 32 0'} fill="none" stroke="#425143" strokeWidth="4" strokeLinecap="round"/>}
      <g fill="#74b95a" opacity=".6"><circle cx="127" cy="151" r="6"/><circle cx="308" cy="143" r="5"/><circle cx="123" cy="273" r="6"/><circle cx="312" cy="279" r="8"/></g>
      <path d="m153 317 1 8m13-9 2 8m104-7-1 8m13-9 1 7" stroke="#d0e7a3" strokeWidth="5" strokeLinecap="round"/>
      {WOUND_MARKS.slice(0, damageCount).map((mark, index) => <g key={index} className="wound-mark" data-wound={index + 1} transform={`translate(${mark.x} ${mark.y}) rotate(${mark.rotation})`}>
        {mark.kind === 'scratch' ? <g fill="none" stroke="#966478" strokeWidth="3.5" strokeLinecap="round"><path d="m-10-6 5 12m3-14 5 12m3-14 5 12"/></g> : mark.kind === 'bandage' ? <g><rect x="-18" y="-8" width="36" height="16" rx="6" fill="#ffe0b5" stroke="#bc9a76" strokeWidth="1.5"/><rect x="-6" y="-7" width="12" height="14" rx="2" fill="#edbd95"/><g fill="#bf946e"><circle cx="-12" cy="-2" r="1"/><circle cx="-12" cy="3" r="1"/><circle cx="12" cy="-2" r="1"/><circle cx="12" cy="3" r="1"/></g></g> : <g><ellipse rx="15" ry="10" fill="#9b7bb0" opacity=".65"/><path d="m-7-3 4 6m3-7 4 6" stroke="#785d91" strokeWidth="2" strokeLinecap="round"/></g>}
      </g>)}
      {damageCount >= 4 && <path d="M322 158q-16 21 0 22 14-1 0-22" fill="#a4e5f5" stroke="#66b4c6" strokeWidth="1.5"/>}
    </g>
  </svg>
}

export function ForestBackdrop() {
  return <svg className="forest-backdrop" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="forest-ground" x2="0" y2="1"><stop stopColor="#49634d" stopOpacity=".25"/><stop offset="1" stopColor="#263f35"/></linearGradient>
      <radialGradient id="clearing-light"><stop stopColor="#adc789" stopOpacity=".18"/><stop offset="1" stopColor="#adc789" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="500" cy="330" rx="360" ry="165" fill="url(#clearing-light)"/>
    <g fill="#50634f" opacity=".16">
      <path d="M80 350Q102 225 94 15h23q-3 186 33 335zM177 335q30-181 11-335h18q-5 188 26 335zM790 340q22-171 9-330h21q-7 184 30 330zM883 350q20-180 2-350h27q-12 205 20 350z"/>
      <path d="M105 134Q57 97 20 118q20-62 94-35 42-55 102-31-38 45-111 82M807 136q-75-14-101-58 61-22 102 19 68-46 113-16-25 45-114 55"/>
    </g>
    <path d="M0 305Q153 267 320 319t349 2q190-63 331-21v100H0z" fill="url(#forest-ground)"/>
    <path d="M0 361q165-37 319-8 175 29 344 0t337 2v45H0z" fill="#253a31" opacity=".8"/>
    <ellipse cx="500" cy="358" rx="192" ry="20" fill="#729165" opacity=".09"/>
    <g fill="#324b3b">
      <path d="M0 385q38-139 13-292L0 70v315m5-181q40-42 79-45-18 41-76 59m7-81Q54 89 82 90q-9 37-67 61M0 159q-35-53-58-63 1 53 58 77"/>
      <path d="M1000 392q-31-178-6-302l6-21v323m-5-181q-49-43-88-38 17 34 86 53m0-79q-31-49-72-54 9 37 71 70"/>
    </g>
    <g stroke="#657b50" strokeWidth="2" fill="#4c6847" opacity=".75">
      <path d="M70 400q-8-42-40-65m34 45q-38 3-41-23 27-2 41 23m-10-17q9-26-10-36-7 17 10 36m13 26q23-28 5-43-13 18-5 43"/>
      <path d="M942 400q0-40 36-75m-27 48q36-1 40-23-25-3-40 23m15-24q-12-25 5-35 11 15-5 35m-18 38q-28-19-15-40 17 11 15 40"/>
    </g>
    <g fill="#aebc7d" opacity=".5"><ellipse cx="143" cy="367" rx="10" ry="3" transform="rotate(-24 143 367)"/><ellipse cx="841" cy="381" rx="9" ry="3" transform="rotate(20 841 381)"/></g>
  </svg>
}

