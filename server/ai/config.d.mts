export interface AIConfig {
  provider:'bailian'|'openai-compatible'
  apiStyle:'openai-compatible'
  apiKey:string
  model:string
  baseUrl:string
}
export function resolveAIConfig(env?:NodeJS.ProcessEnv):{ok:true;config:AIConfig}|{ok:false;error:string;notice:string}
