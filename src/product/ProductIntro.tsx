import { ArrowRight, Camera, Crown, Users, Sparkles, Swords, Trophy, ShieldCheck } from 'lucide-react'
import PartyMonster from '../party/PartyMonster'
import { PARTY_LEVELS } from '../party/levels'
import './product.css'

export function ProductHero({onStart}:{onStart:()=>void}) {
  return <section className="product-hero" aria-labelledby="product-title">
    <div className="product-hero-copy"><span className="product-kicker">一台电脑 · 一个摄像头 · 一群冒险家</span>
      <h1 id="product-title">不用手柄，<br/><em>靠深蹲打怪！</em></h1>
      <p>GymGoGo，AI 体感派对游戏。叫上朋友，戴上你的专属帽子，用身体动作挑战怪兽，回答 AI 健身知识问题，一起完成奇妙的冒险！</p>
      <div className="product-actions"><button className="primary-button" onClick={onStart}>立即开始<ArrowRight size={21}/></button><a href="#how-to-play">了解玩法 <ArrowRight size={17}/></a></div>
      <small className="product-availability" role="note">{import.meta.env.DEV?'AI 知识挑战需本机服务及可用调用额度，在创建派对时检查；也可选择纯运动冒险。':'AI 知识挑战以派对页服务状态为准；未启用或额度用完时，可选择纯运动冒险。'}</small>
    </div>
    <div className="product-hero-art" aria-hidden="true"><span className="hero-orbit">今天，轮到你拯救森林。</span><div className="hero-crown">♛</div><PartyMonster level={PARTY_LEVELS[0]} hit={false} defeated={false} count={0} total={10}/><div className="hero-party-chip"><Users size={18}/> 2–6 人，同屏轮流出招</div><span className="hero-ground"/></div>
  </section>
}

const features = [
  [Camera,'AI 体感识别','摄像头识别明显下蹲与起立，每次有效动作都是一次攻击。'],
  [Users,'多人派对','2–6 人共用一台电脑，轮流上场，也能随时休息或跳过。'],
  [Crown,'AR 趣味帽子','皇冠、海盗帽、魔法帽、派对帽，随头部一起动。'],
  [Sparkles,'AI 知识挑战','启用 AI 后，每人每关一道动态题，理解意思，不用背标准答案。'],
  [Swords,'三关冒险','穿过森林、驱散迷雾、来到巨龙城堡，一起收集徽章。'],
  [Trophy,'趣味反馈','答对 Bingo！答错怪兽占领屏幕。声音可关闭，不影响游玩。'],
] as const

function SceneArt({kind}:{kind:number}) {
  const colors=['#b7e05f','#c9b3ed','#edc77d','#9dcfbe']
  return <svg viewBox="0 0 320 170" role="img" aria-label={['朋友围坐轮流挑战','宿舍里的体感小游戏','家庭成员一起活动','同事在休息区互动'][kind]}>
    <rect x="22" y="16" width="276" height="140" rx="26" fill={colors[kind]} opacity=".12"/>
    {kind===1&&<path d="M36 35h58v102H36m0-62h58M42 48h44m-44 62h44" stroke={colors[kind]} strokeWidth="5" fill="none"/>}
    {kind===2&&<path d="m216 58 28-27 28 27v43h-56Z" fill={colors[kind]} opacity=".35"/>}
    {kind===3&&<><rect x="201" y="30" width="74" height="50" rx="7" fill={colors[kind]} opacity=".3"/><path d="m210 62 16-14 13 8 22-17" fill="none" stroke={colors[kind]} strokeWidth="4"/></>}
    <rect x="117" y="65" width="78" height="51" rx="9" fill="#16382c" stroke={colors[kind]} strokeWidth="3"/><path d="M155 116v13m-24 0h48" stroke={colors[kind]} strokeWidth="5" strokeLinecap="round"/>
    <path d="M141 97q-6-20 14-21t16 21Z" fill={colors[kind]}/><circle cx="150" cy="87" r="2" fill="#16382c"/><circle cx="162" cy="87" r="2" fill="#16382c"/>
    {[0,1].map(i=><g key={i} transform={`translate(${i?240:77} ${i?92:77})`}><circle cy="-14" r="13" fill={i?'#e4bd99':'#e9d2b5'}/><path d="M-18 45V13q18-25 36 0v32" fill={colors[kind]}/><path d={i?'m-15 12-22-19m52 19 18-22':'m-15 13-16 25m46-25 17-29'} stroke={colors[kind]} strokeWidth="9" strokeLinecap="round"/>{!i&&<path d="m-13-26-5-16 15 7 10-12 6 21Z" fill="#edd57c"/>}</g>)}
    <path d="M42 147h236" stroke={colors[kind]} strokeWidth="3" opacity=".3"/>
  </svg>
}

export function ProductGuide() {
  return <div className="product-guide">
    <section className="product-section" aria-labelledby="features-title"><div className="product-section-heading"><span>身体是你的手柄，朋友是你的队友</span><h2 id="features-title">小小客厅，也能装下一场冒险</h2></div><div className="feature-grid">{features.map(([Icon,title,text])=><article key={title}><Icon size={25}/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section id="how-to-play" className="product-section" aria-labelledby="how-title"><div className="product-section-heading"><span>HOW TO PLAY · 不用研究，跟着玩就好</span><h2 id="how-title">从「到齐了」到「我们赢了」</h2></div><div className="play-steps">
      <article><b>01</b><h3>创建你的派对</h3><p>选 2–6 位玩家，填昵称、挑帽子。大家共用一台电脑和摄像头，每次只需当前玩家入镜。</p></article>
      <article><b>02</b><h3>开启体感挑战</h3><p>开启摄像头并授权，点击「准备挑战」后走远入镜。等待就位和倒计时结束，再下蹲、起立；每次有效动作造成 10 点伤害。</p></article>
      <article className="quiz-step"><b>03</b><h3>迎接 AI 怪兽的提问</h3><p>启用 AI 知识挑战后，完成个人动作目标会暂停识别。可以走近电脑，输入简短答案，不限时。AI 理解实际含义，接受合理的不同表述。</p><ul><li><strong>Bingo！</strong>答对后自动轮到下一位勇者。</li><li><strong>怪兽反扑！</strong>明确答错才会本关失败，可重新挑战本关。</li><li><strong>别着急。</strong>无法判断或网络异常不会判失败，可按页面提示重试或安全退出。</li></ul><small>纯运动冒险不包含答题，完成动作目标即可继续。</small></article>
      <article><b>04</b><h3>合力通关，收集徽章</h3><p>AI 模式需全员完成动作且答对，才能解锁下一关。血条清空不等于答题过关。最终查看每人的有效次数、团队贡献和收集的徽章。</p></article>
    </div></section>
    <section className="product-section" aria-labelledby="levels-title"><div className="product-section-heading"><span>THREE WORLDS · 每个人的出招都算数</span><h2 id="levels-title">三站冒险，一个小队</h2><p>按关解锁，不赶时间。需要休息时暂停，进度仍在。</p></div><div className="product-levels">{PARTY_LEVELS.map((level,i)=><article className={`product-level level-${level.theme}`} key={level.id}><span className="level-number">关卡 0{i+1}</span><div className="product-monster" aria-hidden="true"><PartyMonster level={level} hit={false} defeated={false} count={0} total={10}/></div><h3>{level.name}</h3><p><strong>{level.target} 次</strong>有效深蹲 / 人</p><p>AI 模式：每人 1 道知识题</p><small>奖励 · {level.reward}</small><span className="level-route">{i===2?'全队完成 → 最终冒险结算':`全队完成 → 解锁第${i===0?'二':'三'}关`}</span></article>)}</div></section>
    <section className="product-section" aria-labelledby="scenes-title"><div className="product-section-heading"><span>好玩的事，找个伴一起</span><h2 id="scenes-title">适合这些场合</h2></div><div className="scenario-grid">{[
      ['朋友聚会','零食先放一边，轮流打怪！看看谁能躲过怪兽的知识考验。'],
      ['大学宿舍','室友集合，把日常宿舍变成冒险营地。腾出空间再出招。'],
      ['家庭互动','一起动一动、笑一笑。按参与者的身体情况调整幅度，随时休息。'],
      ['公司团建','休息时间或破冰环节，来场轻量合作。不拼速度，也不强求每个人参与。'],
    ].map(([title,text],i)=><article key={title}><SceneArt kind={i}/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="product-section newcomer" aria-labelledby="new-title"><div><span className="product-kicker">FIRST ADVENTURE</span><h2 id="new-title">第一次来？<br/>这样出发就好。</h2><p>无需手柄，不用真实姓名。准备好你和朋友们的小小冒险空间。</p></div><ol>{['推荐使用带摄像头的电脑，Chrome 或 Edge 等现代浏览器。手机适合查看介绍，游玩优先用电脑。','保持适当光线，移开身边障碍物，腾出安全的活动空间。','创建派对，添加昵称和帽子；根据可用服务选择玩法。','点击开启摄像头，允许权限；肩膀、髋部、膝盖和双脚尽量完整入镜。','先点击准备，再走远站稳。可进入战斗大屏，先用「语音试听」确认声音。','按提示轮流挑战；答题时识别待机，可以走近电脑输入答案。休息或跳过都可以。'].map(t=><li key={t}>{t}</li>)}</ol></section>
    <section className="product-section" aria-labelledby="faq-title"><div className="product-section-heading"><span>遇到小状况？</span><h2 id="faq-title">冒险者常见问题</h2></div><div className="product-faq">{[
      ['摄像头无法开启怎么办？','检查浏览器地址栏的摄像头权限，关闭其他占用摄像头的应用，再点击开启。网页需要 HTTPS，或本机 localhost / 127.0.0.1 安全地址。无需麦克风权限。'],
      ['为什么识别不到身体？','让主要关节完整入镜，避免逆光、遮挡和多人同时入镜。可以调整电脑角度或距离；开战斗大屏并试听语音后再走远。'],
      ['为什么答题期间不再识别动作？','这是摄像头待机，避免动作和语音干扰答题。没有重新申请权限；下一位准备或重新挑战时会恢复识别并重置动作基线。'],
      ['AI 问答加载失败怎么办？','先看页面说明：服务未启用、网络异常或额度不足都会暂停问答，不会直接判失败或解锁下一关。按提示手动重试、休息或安全退出。重复请求可能消耗额度；AI 服务可用性以页面状态为准。'],
      ['如何重新挑战当前关卡？','明确答错后，点击「重新挑战本关」。本关动作与答题重新开始，已通过关卡的记录保留；也可以返回派对。'],
      ['跳过和休息会丢进度吗？','跳过保留已完成次数，把你排到本关队尾；全部待完成玩家都跳过时会暂停。休息保留进度，可以继续。纯运动页面刷新会清空，AI 派对按页面提示主动恢复。'],
    ].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
    <section className="product-privacy" aria-labelledby="privacy-title"><ShieldCheck size={30}/><div><h2 id="privacy-title">放心出招，也照顾好自己</h2><p>摄像头与人体姿态识别在浏览器本地运行，应用不上传或录制原始视频。启用 AI 问答时，服务端保存匿名题目与判定，并将题目、参考信息和你提交的文字答案交给百炼处理；不发送视频或人体关键点。请勿在答案中填写个人敏感信息，昵称也无需真实姓名。</p><p>这是趣味动作游戏，不做医学诊断或精准姿势评价。保持安全空间，按自身情况调整幅度，身体不适时停止。</p></div></section>
  </div>
}
