// Protocol/state only. No provider, credentials, reference answers or production mock questions.
export type Verdict = 'correct' | 'incorrect' | 'uncertain'
export type KnowledgePhase = 'quizGenerating' | 'quizAnswering' | 'quizJudging' | 'quizUncertain' | 'quizUnavailable'
export interface Question { questionId: string; question: string }
export interface Judgment { verdict: Verdict; explanation: string; monsterReaction: string }
export interface QuizContext { partyId: string; levelId: string; levelAttemptId: number; playerId: string }
export interface QuizOperation extends QuizContext { operationId: number; kind: 'question' | 'judge'; questionId?: string; answer?: string }
interface Turn {
  phase: KnowledgePhase; question?: Question; answer: string; result?: Judgment;
  operation?: QuizOperation; generations: number; judgments: number; consumed: boolean
}
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 &&
  Array.from(v).length <= max && !/[<>]|https?:/i.test(v)
export function validQuestion(v: unknown): v is Question {
  if (!v || typeof v !== 'object') return false
  const q = v as Question
  return text(q.questionId, 100) && text(q.question, 100)
}
export function validJudgment(v: unknown): v is Judgment {
  if (!v || typeof v !== 'object') return false
  const j = v as Judgment
  return ['correct', 'incorrect', 'uncertain'].includes(j.verdict) && text(j.explanation, 160) && text(j.monsterReaction, 80)
}

export class KnowledgeTurns {
  private turns = new Map<string, Turn>()
  private serial = 0
  export() { return structuredClone({ serial: this.serial, turns: [...this.turns] }) }
  restore(value: ReturnType<KnowledgeTurns['export']>, validContext: (c: QuizContext) => boolean) {
    if (!value || !Number.isSafeInteger(value.serial) || value.serial < 0 || !Array.isArray(value.turns) || value.turns.length > 180) throw Error('invalid_checkpoint')
    const next = new Map<string, Turn>()
    for (const [key, turn] of value.turns) {
      const [partyId, levelId, levelAttemptId, playerId] = JSON.parse(key)
      const context = { partyId, levelId, levelAttemptId, playerId }
      if (!validContext(context) || next.has(key) || !turn ||
        !['quizGenerating','quizAnswering','quizJudging','quizUncertain','quizUnavailable'].includes(turn.phase) ||
        !Number.isInteger(turn.generations) || turn.generations < 0 || turn.generations > 3 ||
        !Number.isInteger(turn.judgments) || turn.judgments < 0 || turn.judgments > 3 ||
        typeof turn.answer !== 'string' || Array.from(turn.answer).length > 120 || typeof turn.consumed !== 'boolean' ||
        (turn.question && !validQuestion(turn.question)) || (turn.result && !validJudgment(turn.result)) ||
        (turn.operation && (!validContext(turn.operation) || this.key(turn.operation) !== key ||
          !Number.isSafeInteger(turn.operation.operationId) || turn.operation.operationId < 1 || turn.operation.operationId > value.serial ||
          !['question','judge'].includes(turn.operation.kind)))) throw Error('invalid_checkpoint')
      next.set(key, structuredClone(turn))
    }
    this.serial = value.serial; this.turns = next
  }
  pending(c: QuizContext) { const op = this.turns.get(this.key(c))?.operation; return op ? { ...op } : null }
  private key(c: QuizContext) { return JSON.stringify([c.partyId, c.levelId, c.levelAttemptId, c.playerId]) }
  ensure(c: QuizContext) {
    if (!this.turns.has(this.key(c))) this.turns.set(this.key(c), {
      phase: 'quizGenerating', answer: '', generations: 0, judgments: 0, consumed: false,
    })
  }
  snapshot(c: QuizContext) {
    const t = this.turns.get(this.key(c))
    return t ? { phase: t.phase, question: t.question && { ...t.question }, answer: t.answer,
      result: t.result && { ...t.result }, generations: t.generations, judgments: t.judgments,
      pending: !!t.operation, consumed: t.consumed } : null
  }
  begin(c: QuizContext, answer?: string): QuizOperation | null {
    const t = this.turns.get(this.key(c))
    if (!t || t.operation || t.consumed || (t.result && t.result.verdict !== 'uncertain')) return null
    if (answer === undefined) {
      if (t.question || !['quizGenerating', 'quizUnavailable'].includes(t.phase) || t.generations >= 3) return null
      t.generations++; t.phase = 'quizGenerating'
    } else {
      if (!t.question || !['quizAnswering', 'quizUncertain', 'quizUnavailable'].includes(t.phase) ||
        !answer.trim() || Array.from(answer).length > 120 || t.judgments >= 3) return null
      t.judgments++; t.answer = answer.trim(); t.phase = 'quizJudging'; t.result = undefined
    }
    t.operation = { ...c, operationId: ++this.serial, kind: answer === undefined ? 'question' : 'judge',
      ...(t.question ? { questionId: t.question.questionId } : {}), ...(answer !== undefined ? { answer: t.answer } : {}) }
    return { ...t.operation }
  }
  receive(op: QuizOperation, value: unknown): boolean {
    const t = this.turns.get(this.key(op))
    if (!t?.operation || JSON.stringify(t.operation) !== JSON.stringify(op)) return false
    t.operation = undefined
    if (op.kind === 'question' && validQuestion(value)) {
      // Copy only public fields, never retain unexpected referenceAnswer/provider fields.
      t.question = { questionId: value.questionId, question: value.question }; t.phase = 'quizAnswering'
    } else if (op.kind === 'judge' && validJudgment(value)) {
      t.result = { verdict: value.verdict, explanation: value.explanation, monsterReaction: value.monsterReaction }
      t.phase = value.verdict === 'uncertain' ? 'quizUncertain' : 'quizJudging'
    } else { t.phase = 'quizUnavailable' }
    return true
  }
  consume(c: QuizContext): Judgment | null {
    const t = this.turns.get(this.key(c))
    if (!t?.result || t.consumed || t.result.verdict === 'uncertain') return null
    t.consumed = true
    return { ...t.result }
  }
  passed(c: QuizContext) { const t = this.turns.get(this.key(c)); return !!t?.consumed && t.result?.verdict === 'correct' }
}
