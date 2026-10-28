export interface BattleSummary {roundId:string;count:number;seconds:number;mode:'real'|'demo';defeated:boolean}
export interface Review {title:string;review:string;source:'local'|'ai';notice?:string;monsterLine?:string;
  receipt?:{id:string;source:'local'|'ai';model:string|null;generatedAt:string}}
export function localReview(result:BattleSummary):Review {
  return {title:result.seconds<60?'萌芽闪击手':result.seconds<180?'森林破关者':'从容冒险家',
    review:`本局完成 ${result.count} 次动作，用时 ${formatDuration(result.seconds)}，贪睡团子已被击败。这是本地生成的通关摘要，尚未请求 AI 创作。`,source:'local'}
}
export function validReview(input:unknown):input is Review {
  if(!input||typeof input!=='object')return false
  const value=input as Review
  return (value.source==='ai'||value.source==='local')&&typeof value.title==='string'&&value.title.length>=2&&value.title.length<=16&&
    typeof value.review==='string'&&value.review.length>=12&&value.review.length<=220&&
    !/卡路里|千卡|热量|燃脂|脂肪|诊断|准确率|心率|疾病|治疗|减重|减肥|公斤|kcal|消耗|[<>]|https?:/i.test(value.title+value.review+(value.monsterLine||''))&&
    (value.monsterLine===undefined||typeof value.monsterLine==='string'&&value.monsterLine.length>=2&&value.monsterLine.length<=30)&&
    (value.source==='local'&&value.receipt===undefined||value.receipt!==null&&typeof value.receipt==='object'&&typeof value.receipt.id==='string'&&value.receipt.id.length>=6&&value.receipt.id.length<=100&&value.receipt.source===value.source&&(value.receipt.model===null||typeof value.receipt.model==='string'&&value.receipt.model.length<=100)&&typeof value.receipt.generatedAt==='string'&&Number.isFinite(Date.parse(value.receipt.generatedAt)))&&
    (value.notice===undefined||typeof value.notice==='string'&&value.notice.length<=100)
}
export function formatDuration(seconds:number){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`}
