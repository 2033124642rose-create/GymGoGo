import type { QuizOperation } from './KnowledgeTurns'
import { NO_EFFECT, PartySession } from './PartySession'

// A transport boundary, not a mock provider. Tests inject fixtures; production UI is not connected yet.
export interface QuizPort {
  question(operation: QuizOperation): Promise<unknown>
  judge(operation: QuizOperation): Promise<unknown>
}
export class QuizCoordinator {
  constructor(private session: PartySession, private port: QuizPort, private checkpoint: () => void = () => {}) {}
  requestQuestion() { return this.run(this.session.beginQuestion()) }
  answer(value: string) { return this.run(this.session.submitAnswer(value)) }
  resumePending() { return this.run(this.session.pendingQuizOperation()) }
  private async run(operation: QuizOperation | null) {
    if (!operation) return { accepted: false, effect: { ...NO_EFFECT } }
    let value: unknown
    try { this.checkpoint(); value = await (operation.kind === 'question' ? this.port.question(operation) : this.port.judge(operation)) }
    catch { value = null }
    return { accepted: true, effect: this.session.receiveQuiz(operation, value) }
  }
}
