import type { QuizOperation } from './KnowledgeTurns'
import type { QuizPort } from './QuizCoordinator'

export interface QuizCredentials { partyId: string; token: string; maxLevel?: number }
export const QUIZ_SAVE_KEY = 'gymgogo.local-knowledge.v1'
const notices: Record<string,string> = {
  disabled:'本地AI未启用，尚未调用模型。', budget_exhausted:'本次调用额度已用完，请休息或安全退出。',
  interrupted_request:'上次请求已中断，可能已消耗额度；不会自动再次调用。可明确重试或退出。',
  model_timeout:'模型响应超时，可能已消耗额度；请主动重试或退出。',
  store_unavailable:'本地题目与预算存储不可用，已停止调用。', session_expired:'保存的派对已过期，不能重新抽取原回合题目。',
  session_invalid:'无法恢复原派对凭据，请结束这场挑战。', question_unsuitable:'AI题目未通过可答性检查，尚未向玩家出题。',
  judgment_format:'判题响应不完整，未判失败。', model_forbidden:'百炼模型权限未通过，请检查服务端配置。',
  model_busy:'模型服务繁忙，未判失败。', generation_limit:'出题尝试次数已用完，请安全退出。', judgment_limit:'本题判题尝试次数已用完，请安全退出。',
  rate_limited:'本分钟请求较多，请等约一分钟后主动重试；本次未调用模型，也未判失败。',
  trial_level_limit:'本场冒险范围为第一关，不会请求后续关卡题目。',
}
export async function quizRequest<T>(route: string, input?: unknown, credentials?: QuizCredentials): Promise<T> {
  const controller = new AbortController(),timer = setTimeout(()=>controller.abort(),16000)
  try {
    const response = await fetch(`/api/quiz/${route}`,{
      method: input === undefined ? 'GET' : 'POST',signal:controller.signal,
      headers: { ...(input === undefined ? {} : {'Content-Type':'application/json'}), ...(credentials ? {'X-Party-Token':credentials.token} : {}) },
      ...(input === undefined ? {} : {body:JSON.stringify(input)}),
    })
    const value = await response.json()
    if (!response.ok || value?.error) {
      const reasons:Record<string,string>={question_fields:'题干、参考或解释格式不合格',key_points:'核心要点格式不合格',topic:'主题字段不符合约定',difficulty:'难度字段不符合当前关卡',answerability:'模型无法确认题目可明确回答',restricted_content:'内容超出基础运动知识范围',duplicate_question:'与本场已出题重复'}
      throw Error((notices[value?.error] || 'AI服务暂不可用，未判失败；请主动重试或安全退出。')+(reasons[value?.reason]?' 原因：'+reasons[value.reason]+'。':''))
    }
    return value as T
  } catch (e) {
    if (controller.signal.aborted) throw Error('连接超时，可能已消耗额度；不会自动再次调用。')
    throw e
  } finally { clearTimeout(timer) }
}
export function quizPort(credentials: QuizCredentials, notice: (message:string)=>void): QuizPort {
  const run = async (operation: QuizOperation) => {
    try { return await quizRequest(operation.kind === 'question' ? 'question' : 'judge',operation,credentials) }
    catch(e) { notice(e instanceof Error ? e.message : '连接失败，未判失败。'); throw e }
  }
  return { question:run,judge:run }
}
