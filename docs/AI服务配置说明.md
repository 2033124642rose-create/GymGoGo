> 2026-10-30 后续更新：Pages Functions + 私有Worker + SQLite预算已新增并本地模拟验证，尚未部署。下文“当前公网未接通”指现有部署事实；新的云端配置和发布步骤请以《Cloudflare公网AI部署与预算》《以后如何更新并发布GymGoGo》为准。

# GymGoGo AI 服务配置说明

## 当前使用什么

2026-10-30 本机配置只读检查：服务商为阿里云百炼，模型为 `qwen-flash`，兼容接口域名为 `dashscope.aliyuncs.com`，密钥已配置。只检查配置，没有向模型发请求，也没有验证剩余额度或当前账号权限。

本轮没有改动你的 `.env.local`、已有模型、预算账本或公网开关。原来的 `DASHSCOPE_API_KEY`、`BAILIAN_BASE_URL`、`BAILIAN_MODEL` 配置继续有效，不需要为了这次整理重填 Key。

## 配置在哪里

**本地：** `D:\gymgogogo\.env.local`，用 VS Code 在本机编辑。不要把 Key 发到聊天或截图，也不要放进任何 `VITE_` 变量。

新配置统一使用下表（只在服务端读取）：

| 配置 | 用途 | 当前 / 默认 |
| --- | --- | --- |
| `AI_PROVIDER` | 服务商适配策略 | `bailian`；其他兼容服务用 `openai-compatible` |
| `AI_API_STYLE` | 接口协议 | `openai-compatible` |
| `AI_BASE_URL` | 接口基础地址，不带 `/chat/completions` | 百炼默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`；不同地域以自己的控制台为准 |
| `AI_API_KEY` | 对应服务商的 Key | 只能在本机或服务端秘密配置中填写 |
| `AI_MODEL` | 模型名称 | `qwen-flash` |
| `AI_ALLOWED_HOSTS` | 其他兼容服务的精确域名白名单 | 百炼无需配置；其他服务必须与基础地址主机一致，可逗号分隔，无通配符 |
| `AI_DAILY_LIMIT` | 旧单人战报每进程每日限制 | 默认 20，不是问答全局预算 |

只启用一个配置来源，减少混淆。新变量优先：对应 `AI_*` **不存在**时，百炼才读取旧变量；如果新变量明确留空，视为配置缺失，不偷偷回退到旧值。`AI_PROVIDER` 未填写时默认百炼。

旧变量对应关系：`DASHSCOPE_API_KEY → AI_API_KEY`；`BAILIAN_BASE_URL → AI_BASE_URL`；`BAILIAN_MODEL → AI_MODEL`；`BAILIAN_DAILY_LIMIT → AI_DAILY_LIMIT`。切换到其他服务商后，不继承百炼 Key、地址和模型，必须单独提供。

仓库的 `.env.example` 只是空密钥模板，可以公开；不要用它覆盖你已经填好的本地文件。

## 只换模型时

1. 保持服务商、地址、Key 不变，修改 `AI_MODEL`。建议迁移时删除或注释旧 `BAILIAN_MODEL`，避免以后误读。
2. 核对该模型是否支持当前 JSON 接口、上下文限制、输出参数和非思考模式。当前适配器需要 `chat/completions`、`max_tokens` 和 `response_format: json_object`；不能保证所有标榜兼容的模型都支持全部参数。
3. 更新价格与价格绑定，重启本地服务。**不能只改模型而沿用旧模型的价格。**

本轮没有替你切换；仍使用 qwen-flash。

## 换 API 服务商时

对于支持上述 OpenAI-compatible 接口的服务，设置：

```dotenv
AI_PROVIDER=openai-compatible
AI_API_STYLE=openai-compatible
AI_BASE_URL=https://api.your-provider.example/v1
AI_ALLOWED_HOSTS=api.your-provider.example
AI_MODEL=the-model-name-from-your-provider
AI_API_KEY=
```

上面是说明用占位地址和空 Key，不是可用服务或推荐名单。使用你实际服务商提供的基础地址、模型和密钥，并先核对计费。地址只接受 HTTPS、标准端口、无账户密码 / 查询参数 / 锚点；不支持本地 HTTP 模型服务、IP 地址、任意重定向。域名白名单由你在服务端配置，不由浏览器玩家传入。

百炼适配保留 `enable_thinking: false`；其他兼容服务不发送这个百炼专用字段。相同的出题 / 判题提示词、结果校验、monsterReaction 和游戏状态不需要修改。

如果是**不兼容的协议**，不能仅改 URL：需要在 `server/ai/` 新增独立适配器，扩展配置校验和客户端适配选择，再用模拟响应测试。业务仍调用 `generateJSON({messages,maxTokens,temperature})`，不改游戏状态机。当前只实现并测试百炼及 OpenAI-compatible 协议，没有实际验证其他服务商账号。

## 问答开关、额度和价格

原有配置继续保留：

- `GYMGO_QUIZ_ENABLED`：本地问答开关。
- `QUIZ_MAX_LEVEL`：本场关卡范围。
- `QUIZ_APPROVED_CALLS` / `QUIZ_BUDGET_CNY`：授权次数和总金额。
- `QUIZ_INPUT_CNY_PER_MILLION` / `QUIZ_OUTPUT_CNY_PER_MILLION`：对应模型、地域的人民币单价。
- `QUIZ_PRICE_CHECKED_ON`：价格核对日期，须满足近期检查规则。
- `QUIZ_PRICE_PROVIDER` / `QUIZ_PRICE_MODEL`：价格属于哪个服务商策略和模型。换服务商或模型时必须与 `AI_PROVIDER` / `AI_MODEL` 一致。原百炼 qwen-flash 为兼容旧配置可以暂不写这两项；一旦写了就必须匹配。

出题最多 400 输出 token，判题 300，单人战报 280；不自动重试或自动切换供应商。调用失败仍按原规则保留次数 / 预算占用。已有 `.local/quiz-state.json` 不清零，不通过删文件“获得新额度”。换配置不增加总次数或金额，不能让原来已用额度消失。

价格不同货币时，需先保守换算成人民币，不要直接把美元数字填入人民币字段。免费额度能否使用、还有多少，只能在服务商控制台核对；应用不会假定永远免费。本地进程限制不能作为公网全局费用保证。

## 修改后如何重启

1. 在运行 Vite 的终端按 `Ctrl+C`，停止本机服务。
2. 保存 `.env.local`。
3. 在 `D:\gymgogogo` 运行 `npm run dev`，打开 `http://127.0.0.1:5173/`。
4. 派对页勾选本地 AI 知识挑战时会检查配置与额度。此配置检查不调用模型；真正出题 / 判题会消耗请求，需先确认测试授权。

`npm run preview` 只预览生产静态页面，不运行本地问答服务。不能把它用于验证真实问答连接。

缺少 Key、模型或地址错误时，问答保持禁用并显示配置提示；单人战报提供本地备用内容。不会把配置错误当作玩家答错。静态检查无法证明 Key 有效、模型可访问或额度足够；这些需要以后获授权的真实联调。本轮没有做真实联调。

## Cloudflare 公网在哪里配置

未来的服务端配置位置是 Cloudflare 控制台对应 Pages 项目的“设置 → 变量和机密”（实际界面名称可能不同）：Key 用加密 Secret，其他值用服务端变量，生产与预览环境分别管理。不要把真实 Key 写进 Git 配置、构建命令或 `VITE_` 变量。

**当前公网仍不具备完整 AI 问答服务。** 现有 Cloudflare `/api/review` 只返回本地备用，根本不读取这些 AI 配置；本地 `/api/quiz/*` 仍依赖 Vite 开发服务。因此现在仅添加 Cloudflare 环境变量、重新部署，都不会使问答可用；不建议目前上传 Key。

未来需先移植服务端入口，显式把 Cloudflare 服务端 `context.env` 传给配置层，处理 Node 运行时兼容、可靠全局预算和访问控制，再在授权额度内验证。当前本地模块仍包含 Node / 文件存储依赖，不能声称已可直接用于 Workers。该工作不属于本轮配置整理，发布阻塞继续保留。

服务端和预算方案完成并获授权后，才按原 GitHub → Cloudflare Pages 构建部署流程发布；变更生产变量后需要新的部署使其生效。**本轮不推送、不部署、不开放公网 AI。**

## 哪些文件负责什么

- `server/ai/config.mjs`：服务商、地址、密钥、模型统一读取与校验。
- `server/ai/client.mjs`：统一 JSON 模型调用接口、请求上限、超时、无自动重试。
- `server/ai/openai-compatible.mjs`：鉴权、协议参数、响应大小及结构解析、错误映射；不包含游戏规则。
- `server/quiz.mjs`：出题和语义判题业务，保留题目安全检查、去重、回合 / 三关规则及持久预算。
- `server/review.mjs`：单人战报业务，复用相同模型接口，保留本地备用与公网关闭行为。

`.gitignore` 忽略 `.env*`（仅允许空模板 `.env.example`）、`.dev.vars*`、`.wrangler/` 与 `.local/`。任何忽略规则都不能防止人为强制提交或把 Key 粘到普通源文件；不要这样操作。
