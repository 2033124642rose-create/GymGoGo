import { describe, expect, it, vi } from 'vitest'
import { PartySession } from '../src/party/PartySession'
import { QuizCoordinator } from '../src/party/QuizCoordinator'
import type { QuizPort } from '../src/party/QuizCoordinator'
import type { QuizOperation, Verdict } from '../src/party/KnowledgeTurns'
import { makeSequence, poseFrame } from './squat-fixtures'

// Synthetic protocol fixtures only, never a product question bank or a claim of real AI semantics.
const question = { questionId: 'fixture-question', question: '这是协议测试用的合成题目' }
const judgment = (verdict: Verdict) => ({ verdict, explanation: '合成判题解释', monsterReaction: '合成怪兽反馈' })
function setup(n = 2) {
  const game = new PartySession(Array.from({ length: n }, (_, i) => `玩家${i + 1}`), undefined, { knowledgeChallenge: true })
  const seq = makeSequence()
  const feed = (angle: number, drop: number, ms: number) => seq.hold(angle, drop, ms).map(f => game.frame(f))
  const start = () => { game.prepare(seq.time); feed(175, 0, 5500); expect(game.snapshot().phase).toBe('active') }
  const rep = () => { feed(175, 0, 500); feed(130, .08, 500); return feed(175, 0, 700) }
  const finishMotion = () => {
    const s = game.snapshot(), p = s.players.find(p => p.id === s.currentId)!
    start(); for (let i = p.count; i < s.level.target; i++) rep()
    expect(game.snapshot().phase).toBe('quizGenerating')
  }
  const ask = () => { const op = game.beginQuestion()!; expect(op).not.toBeNull(); game.receiveQuiz(op, question); return op }
  const answer = (verdict: Verdict = 'correct') => {
    const op = game.submitAnswer('合成答案')!; expect(op).not.toBeNull()
    return { op, effect: game.receiveQuiz(op, judgment(verdict)) }
  }
  const finishLevel = () => {
    for (let i = 0; i < n; i++) {
      if (game.snapshot().phase === 'turnComplete') game.next(seq.time)
      finishMotion(); ask(); answer()
    }
  }
  return { game, seq, feed, start, rep, finishMotion, ask, answer, finishLevel }
}

describe('knowledge-gated party, local state/protocol only', () => {
  it.each([1,2])('retries level index %i without losing prior rewards or accepting an old judgment',level=>{
    const s=setup()
    for(let i=0;i<level;i++){s.finishLevel();s.game.nextLevel(s.seq.time)}
    s.finishMotion();s.ask();s.answer();s.game.next(s.seq.time)
    s.finishMotion();s.ask();const failed=s.answer('incorrect').op
    expect(s.game.snapshot().phase).toBe('levelFailed')
    const prior=s.game.snapshot().players.map(p=>p.counts.slice(0,level))
    s.game.retryLevel(s.seq.time)
    expect(s.game.snapshot()).toMatchObject({levelIndex:level,levelAttemptId:2,total:0,hp:2*(level+2)*10,completedLevels:level})
    expect(s.game.snapshot().players.map(p=>p.counts.slice(0,level))).toEqual(prior)
    const before=s.game.snapshot();s.game.receiveQuiz(failed,judgment('correct'));expect(s.game.snapshot()).toEqual(before)
    s.finishMotion();expect(s.game.beginQuestion()?.levelAttemptId).toBe(2)
  })
  it('locks motion at target without removing the player or awarding victory', () => {
    const s = setup(); s.finishMotion()
    expect(s.game.snapshot()).toMatchObject({ total: 2, hp: 20, queue: ['player-1', 'player-2'], completedLevels: 0 })
    const before = s.game.snapshot(); s.rep(); s.game.next(s.seq.time); s.game.nextLevel(s.seq.time)
    s.game.acceptRep(before.attempt, 1)
    expect(s.game.snapshot()).toEqual(before)
    s.ask(); s.answer(); expect(s.game.snapshot()).toMatchObject({ phase: 'turnComplete', queue: ['player-2'] })
  })
  it('zero HP is not victory; only the final correct answer emits one victory event', () => {
    const s = setup(); s.finishMotion(); s.ask(); s.answer(); s.game.next(s.seq.time); s.finishMotion()
    expect(s.game.snapshot()).toMatchObject({ hp: 0, completedLevels: 0, rewards: [], phase: 'quizGenerating' })
    s.game.nextLevel(s.seq.time); expect(s.game.snapshot().levelIndex).toBe(0)
    s.ask(); const { op, effect } = s.answer()
    expect(effect).toMatchObject({ attack: false, levelWon: true, won: false })
    expect(s.game.snapshot()).toMatchObject({ phase: 'levelWon', completedLevels: 1 })
    expect(s.game.receiveQuiz(op, judgment('correct')).levelWon).toBe(false)
  })
  it.each([2, 6])('gates every player in all three levels for %i players', n => {
    const s = setup(n)
    for (let level = 0; level < 3; level++) {
      s.finishLevel()
      expect(s.game.snapshot()).toMatchObject({ phase: level === 2 ? 'won' : 'levelWon', completedLevels: level + 1, hp: 0 })
      if (level < 2) s.game.nextLevel(s.seq.time)
    }
    expect(s.game.snapshot().teamTotal).toBe(n * 9)
    expect(s.game.snapshot().players.every(p => p.totalCount === 9)).toBe(true)
  })
  it('does not generate twice or accept a forged operation; public snapshot strips private fields', () => {
    const s = setup(); s.finishMotion(); const op = s.game.beginQuestion()!
    expect(s.game.beginQuestion()).toBeNull()
    s.game.receiveQuiz({ ...op, operationId: op.operationId + 1 }, question)
    expect(s.game.snapshot().quiz?.pending).toBe(true)
    s.game.receiveQuiz(op, { ...question, referenceAnswer: '不得进入快照', explanation: '隐藏解释' })
    const snap = s.game.snapshot()
    expect(JSON.stringify(snap)).not.toContain('不得进入快照')
    expect(snap.quiz?.question).toEqual(question)
    snap.quiz!.question!.question = '篡改副本'
    expect(s.game.snapshot().quiz?.question).toEqual(question)
    expect(s.game.beginQuestion()).toBeNull()
  })
  it('only incorrect fails; invalid verdicts or missing fields are unavailable', () => {
    for (const value of [null, {}, { verdict: 'incorrect' }, judgment('uncertain'), { ...judgment('incorrect'), verdict: 'unknown' }]) {
      const s = setup(); s.finishMotion(); s.ask(); const op = s.game.submitAnswer('合成答案')!
      s.game.receiveQuiz(op, value)
      expect(['quizUnavailable', 'quizUncertain']).toContain(s.game.snapshot().phase)
      expect(s.game.snapshot().completedLevels).toBe(0)
    }
    const s = setup(); s.finishMotion(); s.ask(); s.answer('incorrect')
    expect(s.game.snapshot().phase).toBe('levelFailed')
    s.game.skip(0); s.game.nextLevel(0); s.rep(); expect(s.game.snapshot().phase).toBe('levelFailed')
  })
  it('uncertain keeps the same question, caps explicit judgments and never awards or fails', () => {
    const s = setup(); s.finishMotion(); s.ask()
    for (let i = 0; i < 3; i++) { s.answer('uncertain'); expect(s.game.snapshot().phase).toBe('quizUncertain') }
    expect(s.game.submitAnswer('再次重试')).toBeNull()
    expect(s.game.snapshot()).toMatchObject({ completedLevels: 0, quiz: { judgments: 3, question } })
    expect(s.game.beginQuestion()).toBeNull()
    s.game.exit(s.seq.time); expect(s.game.snapshot().phase).toBe('exited')
  })
  it('rejects empty/oversized answers before creating a paid operation, and double submit', () => {
    const s = setup(); s.finishMotion(); s.ask()
    expect(s.game.submitAnswer('  ')).toBeNull(); expect(s.game.submitAnswer('字'.repeat(121))).toBeNull()
    expect(s.game.snapshot().quiz?.judgments).toBe(0)
    const op = s.game.submitAnswer('短答')!
    expect(s.game.submitAnswer('短答')).toBeNull(); s.game.receiveQuiz(op, judgment('correct'))
    expect(s.game.submitAnswer('短答')).toBeNull()
  })
  it('generation failures cap retries, never create a fake local question or release counting', () => {
    const s = setup(); s.finishMotion()
    for (let i = 0; i < 3; i++) { const op = s.game.beginQuestion()!; s.game.receiveQuiz(op, null) }
    expect(s.game.snapshot()).toMatchObject({ phase: 'quizUnavailable', quiz: { generations: 3 } })
    expect(s.game.snapshot().quiz?.question).toBeUndefined(); expect(s.game.beginQuestion()).toBeNull()
    s.rep(); expect(s.game.snapshot().total).toBe(2)
  })
  it('pauses a generation in flight, saves its response and restores the same question on resume', () => {
    const s = setup(); s.finishMotion(); const op = s.game.beginQuestion()!
    s.game.pause(s.seq.time); s.game.receiveQuiz(op, question)
    expect(s.game.snapshot().phase).toBe('paused'); s.rep(); expect(s.game.snapshot().total).toBe(2)
    s.game.resume(s.seq.time); expect(s.game.snapshot()).toMatchObject({ phase: 'quizAnswering', quiz: { question } })
    expect(s.game.beginQuestion()).toBeNull()
  })
  it.each(['correct', 'incorrect'] as const)('defers an in-flight %s judgment until resume, consumes once', verdict => {
    const s = setup(); s.finishMotion(); s.ask(); const op = s.game.submitAnswer('答案')!
    s.game.pause(s.seq.time); expect(s.game.receiveQuiz(op, judgment(verdict)).levelWon).toBe(false)
    expect(s.game.snapshot().phase).toBe('paused')
    s.game.resume(s.seq.time); expect(s.game.snapshot().phase).toBe(verdict === 'correct' ? 'turnComplete' : 'levelFailed')
    const before = s.game.snapshot(); s.game.receiveQuiz(op, judgment('correct')); expect(s.game.snapshot()).toEqual(before)
  })
  it('defers a question to queue tail without regenerating or creating a zero-target counter', () => {
    const s = setup(); s.finishMotion(); s.ask(); s.game.skip(s.seq.time)
    expect(s.game.snapshot().currentId).toBe('player-2')
    s.game.skip(s.seq.time); expect(s.game.snapshot().phase).toBe('blocked')
    s.game.resume(s.seq.time); expect(s.game.snapshot()).toMatchObject({ phase: 'quizAnswering', currentId: 'player-1' })
    s.game.prepare(s.seq.time); s.rep(); expect(s.game.snapshot().total).toBe(2)
    expect(s.game.beginQuestion()).toBeNull(); s.answer()
    s.game.next(s.seq.time); s.start(); expect(s.game.snapshot().currentId).toBe('player-2')
  })
  it('retry resets only this level, preserves hats/prior badges and archives failed movement', () => {
    const s = setup(); s.finishLevel(); s.game.nextLevel(s.seq.time)
    s.finishMotion(); const stale = s.ask(); s.answer('incorrect')
    const hats = s.game.snapshot().players.map(p => p.hat)
    s.game.retryLevel(s.seq.time); s.game.retryLevel(s.seq.time)
    expect(s.game.snapshot()).toMatchObject({ phase: 'ready', levelIndex: 1, levelAttemptId: 2, hp: 60, total: 0,
      completedLevels: 1, teamTotal: 4, failedAttempts: [{ levelIndex: 1, levelAttemptId: 1, counts: [3, 0] }] })
    expect(s.game.snapshot().players.map(p => p.hat)).toEqual(hats)
    const before = s.game.snapshot(); s.game.receiveQuiz(stale, question); s.game.frame(poseFrame(1)); expect(s.game.snapshot()).toEqual(before)
    s.finishMotion(); expect(s.game.beginQuestion()?.levelAttemptId).toBe(2)
  })
  it('ignores wrong session/player, delayed submissions after exit and duplicate result receipts', () => {
    const s = setup(); s.finishMotion(); s.ask(); const op = s.game.submitAnswer('答案')!
    for (const other of [{ ...op, partyId: 'forged' }, { ...op, playerId: 'player-2' }]) s.game.receiveQuiz(other, judgment('incorrect'))
    expect(s.game.snapshot().phase).toBe('quizJudging')
    s.game.exit(s.seq.time); const before = s.game.snapshot(); s.game.receiveQuiz(op, judgment('correct')); expect(s.game.snapshot()).toEqual(before)
  })
  it('resuming the last judgment emits victory once and never a second attack', () => {
    const s = setup(); s.finishMotion(); s.ask(); s.answer(); s.game.next(s.seq.time)
    s.finishMotion(); s.ask(); const op = s.game.submitAnswer('答案')!
    s.game.pause(s.seq.time); s.game.receiveQuiz(op, judgment('correct'))
    expect(s.game.snapshot()).toMatchObject({ phase: 'paused', hp: 0, completedLevels: 0 })
    expect(s.game.resume(s.seq.time)).toMatchObject({ levelWon: true, won: false, attack: false })
    expect(s.game.resume(s.seq.time)).toBeUndefined()
    expect(s.game.receiveQuiz(op, judgment('correct')).levelWon).toBe(false)
  })
  it('cannot reuse prior question/judgment tokens after changing levels', () => {
    const s = setup(); s.finishMotion(); const oldQuestion = s.ask(); const oldJudge = s.answer().op
    s.game.next(s.seq.time); s.finishMotion(); s.ask(); s.answer(); s.game.nextLevel(s.seq.time)
    s.finishMotion(); const before = s.game.snapshot()
    s.game.receiveQuiz(oldQuestion, question); s.game.receiveQuiz(oldJudge, judgment('incorrect'))
    expect(s.game.snapshot()).toEqual(before)
    expect(s.game.beginQuestion()?.levelId).toBe('ghost-realm')
  })
  it('restores active progress as paused and discards the unfinished physical action', () => {
    const s = setup(); s.start(); s.rep(); s.feed(130,.08,600)
    const game = PartySession.restore(JSON.stringify(s.game.checkpoint()))
    expect(game.snapshot()).toMatchObject({phase:'paused',total:1,hp:30})
    s.seq.hold(175,0,700).forEach(f=>game.frame(f)); expect(game.snapshot().total).toBe(1)
    game.resume(s.seq.time);expect(game.snapshot().phase).toBe('ready')
  })
  it('restores a pending question with the original operation id and never creates a new operation', () => {
    const s = setup();s.finishMotion();const op=s.game.beginQuestion()!
    const game=PartySession.restore(JSON.stringify(s.game.checkpoint()))
    game.resume(s.seq.time);expect(game.pendingQuizOperation()).toEqual(op);expect(game.beginQuestion()).toBeNull()
    game.receiveQuiz(op,question);expect(game.snapshot()).toMatchObject({phase:'quizAnswering',quiz:{generations:1,question}})
  })
  it('restores a pending judgment, accepts its saved receipt once and retains the exact short answer', () => {
    const s = setup();s.finishMotion();s.ask();const op=s.game.submitAnswer('我自己的短答')!
    const game=PartySession.restore(JSON.stringify(s.game.checkpoint()));game.resume(s.seq.time)
    expect(game.pendingQuizOperation()).toEqual(op);expect(game.submitAnswer('不同短答')).toBeNull()
    game.receiveQuiz(op,judgment('correct'));expect(game.snapshot().phase).toBe('turnComplete')
    const before=game.snapshot();game.receiveQuiz(op,judgment('incorrect'));expect(game.snapshot()).toEqual(before)
  })
  it('preserves rewarded levels and failed attempts in a checkpoint, without persisting pose data', () => {
    const s=setup();s.finishLevel();s.game.nextLevel(s.seq.time);s.finishMotion();s.ask();s.answer('incorrect');s.game.retryLevel(s.seq.time)
    const raw=JSON.stringify(s.game.checkpoint()),game=PartySession.restore(raw)
    expect(game.snapshot()).toMatchObject({levelIndex:1,levelAttemptId:2,completedLevels:1,teamTotal:4})
    expect(game.snapshot().failedAttempts).toHaveLength(1);expect(raw).not.toMatch(/landmarks|worldLandmarks|referenceAnswer/)
  })
  it('rejects oversized, broken, impossible victory and unsafe resume checkpoints', () => {
    const s=setup(),checkpoint=s.game.checkpoint()
    for(const value of [null,{...checkpoint,phase:'won'},{...checkpoint,resumeTo:'active'},{...checkpoint,queue:['invalid']},
      {...checkpoint,players:checkpoint.players.map(p=>({...p,counts:[99,0,0]}))}])expect(()=>PartySession.restore(JSON.stringify(value))).toThrow()
    expect(()=>PartySession.restore('bad-json')).toThrow();expect(()=>PartySession.restore('x'.repeat(100001))).toThrow()
  })
})

describe('two-call coordinator with injected test port, not real AI', () => {
  it('calls question and judge once and gets the monster response without a third call', async () => {
    const s = setup(); s.finishMotion()
    const port = { question: vi.fn(async () => question), judge: vi.fn(async () => judgment('correct')) }
    const c = new QuizCoordinator(s.game, port)
    await Promise.all([c.requestQuestion(), c.requestQuestion()])
    await Promise.all([c.answer('答案'), c.answer('答案')])
    expect(port.question).toHaveBeenCalledTimes(1); expect(port.judge).toHaveBeenCalledTimes(1)
    expect(s.game.snapshot()).toMatchObject({ phase: 'turnComplete', quiz: { result: { monsterReaction: '合成怪兽反馈' } } })
  })
  it('handles rejected/unknown responses as unavailable without automatically retrying', async () => {
    const s = setup(); s.finishMotion()
    const port: QuizPort = { question: vi.fn(async () => { throw Error('simulated 403/timeout') }), judge: vi.fn() }
    const c = new QuizCoordinator(s.game, port); await c.requestQuestion()
    expect(s.game.snapshot().phase).toBe('quizUnavailable')
    expect(port.question).toHaveBeenCalledTimes(1); expect(port.judge).not.toHaveBeenCalled()
  })
  it('does not let a delayed mock response revive an exited game', async () => {
    const s = setup(); s.finishMotion(); let resolve!: (v: unknown) => void
    const port = { question: vi.fn(() => new Promise<unknown>(r => { resolve = r })), judge: vi.fn() }
    const c = new QuizCoordinator(s.game, port); const pending = c.requestQuestion()
    s.game.exit(s.seq.time); resolve(question); await pending
    expect(s.game.snapshot().phase).toBe('exited')
  })
  it('sends only context and short answer to the port, no landmarks, nicknames or reference answer', async () => {
    const s = setup(); s.finishMotion(); const operations: QuizOperation[] = []
    const port = { question: async (op: QuizOperation) => { operations.push(op); return question },
      judge: async (op: QuizOperation) => { operations.push(op); return judgment('uncertain') } }
    const c = new QuizCoordinator(s.game, port); await c.requestQuestion(); await c.answer('答案')
    const keys = new Set(operations.flatMap(o => Object.keys(o)))
    expect([...keys].sort()).toEqual(['answer', 'kind', 'levelAttemptId', 'levelId', 'operationId', 'partyId', 'playerId', 'questionId'].sort())
  })
})
