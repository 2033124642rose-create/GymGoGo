# Cloudflare 公网 AI 部署与预算

日期：2026-10-30。本轮仅本地开发、模拟模型测试、离线编译；未提交、推送、部署或真实调用百炼。

## 最小方案

保持现有 React/Vite + Cloudflare Pages。浏览器仅请求同源 /api/quiz/*；Pages Functions 限定方法、Origin、请求体，重新构造可信来源头，转发 QUIZ_SERVICE 服务绑定。独立 Worker 无 workers.dev、预览 URL 或公开路由，仅经服务绑定到达。Worker 将 Cloudflare 提供的来源 IP 用独立 Secret HMAC，固定路由到 global-budget-v1 Durable Object。生产、预览 Pages 绑定同一个 Worker，因此共享总账本，不能各领 1000 次。

SQLite DO 内部串行处理整个模型操作（同时一个，最多四个排队含当前）。模型前以 transactionSync 原子预留计数和保守费用；模型返回后保存题目 / 判定。断连、超时、失败及不明结果不退款，不自动重新请求；对象重建会把 pending 标为已中断，原操作不可自动重发。缓存结果及回合校验复用现有问答核心，不以 HP 归零替代全员答题成功。

本地 server/quiz.mjs 为原文件存储包装，server/quiz-core.mjs 为复用核心；云端不导入 quiz-store.mjs 或 node:fs。Cloudflare 使用 nodejs_compat 支持 node:crypto / Buffer。真实 workerd 测试发现 redirect:error 不支持，已改 manual，3xx 仍被拒绝且不会转发密钥。

## 权威限额与边界

- QUIZ_APPROVED_CALLS=1000：累计，不随日期、部署或重启清零。
- QUIZ_DAILY_CALLS=300：全站每日，按北京时间日期。
- QUIZ_SOURCE_DAILY_CALLS=60：来源每日。
- QUIZ_SOURCE_MINUTE_CALLS=10：来源滑动一分钟，超出返回 rate_limited。
- MODEL_TIMEOUT_MS：默认 12000，最高 12000；输入 JSON 消息最多 9000 UTF-8 字节，外部请求体最多 2048 字节。
- 出题输出最多 400 token，判题 300，模型响应最多 32000 字节。没有额外模型调用生成语音。

上述次数配置在 Worker 服务端调整，游戏不用修改。提高任何上限必须重新确认风险和授权；不删除 DO、迁移清空命名空间或更改固定全局对象名绕过额度。没有普通用户重置接口，也暂不提供管理重置功能。确需重置应先关闭 AI，导出旧计数，审核一次性迁移，再由管理员发布；本轮不实现或执行重置。

模型请求前按每次 10000 输入 token + 400 输出 token 和已核对人民币价格保守预留微元；实际正文上限为 9000 UTF-8 字节，留出消息封装余量，不启用思考。1000 次不是账单金额上限，真实账单、分词 / 计费规则、其他应用共用 Key、配置错误或服务商调整不受此本地估算保证。QUIZ_BUDGET_CNY 是另一个总预留上限，当前为 0，所以默认不能调用。价格须每 7 天核对且绑定模型 / 服务商，过期停止调用。

举例仅用于算术：输入每百万0.15元、输出每百万1.5元时，每次预留0.0021元，1000次预留2.10元。这不是当前价格核实或允许收费；必须以本人地域控制台为准。免费额度按输入+输出共同消耗，次数限制不等于免费 token 不会用完。

来源是 Cloudflare 的 CF-Connecting-IP，经内部 Worker HMAC 后入 SQLite，不保存明文 IP；每日来源记录在后续预留时清理旧日期。共享 Wi-Fi / NAT 会共用60次，代理/VPN更换出口可绕过来源限额，某些代理或 Worker 转发亦影响来源可靠性；它不是身份认证。全站1000/300与金额上限不因换IP绕过。公开匿名服务仍可能被恶意用尽额度或资源；若需要受邀范围，应另行启用合适的访问保护，不能承诺完全防机器人。队列 / 8MB状态大小 / 2048个派对等资源保护到达即停；不为腾空间丢弃幂等记录。

## 配置清单

Pages（根 wrangler.jsonc）：PUBLIC_AI_ENABLED=false；QUIZ_SERVICE 绑定 gymgogo-quiz-service。预览也指向相同服务，但开关独立且默认关闭。

Worker（cloudflare/wrangler.jsonc）：
- PUBLIC_AI_ENABLED=false、FREE_QUOTA_CONFIRMED=false；双重默认关闭。
- AI_PROVIDER=bailian、AI_MODEL=qwen-flash、AI_BASE_URL 为本人北京地域兼容接口。
- 上述四类次数、QUIZ_BUDGET_CNY、QUIZ_INPUT_CNY_PER_MILLION、QUIZ_OUTPUT_CNY_PER_MILLION、QUIZ_PRICE_CHECKED_ON、QUIZ_PRICE_PROVIDER、QUIZ_PRICE_MODEL。
- Secret：AI_API_KEY（或原 DASHSCOPE_API_KEY 兼容值）；SOURCE_HASH_SECRET（至少32字符随机值）；QUIZ_ADMIN_TOKEN（至少32字符随机值）。仅管理员查看还需同一 QUIZ_ADMIN_TOKEN 配置在 Pages Secret；Pages不需要模型 Key。

Key 只填 Worker Secret，不写配置文件、构建命令或前端变量。普通变量可纳入已审查配置；不要把云端授权次数同步覆盖本地 .env.local / .local账本。项目现有本地Key未改。

生产与预览前端隔离，权威预算故意共享。预览真实验证也占总1000次；未授权前不要向任何环境配置启用开关。不要另建第二个可调用模型的 Worker 形成第二份预算。切换 Key / 来源哈希Secret不清空全站账本。

## 百炼免费保护：必须本人核对后才能开放

用电脑登录百炼，选择华北2（北京），进入免费额度页面，搜索精确模型 Code qwen-flash：
1. 记录剩余免费 token 和到期时间（不要发送 Key）。
2. 确认 Key 的地域 / 业务空间与实际基础地址匹配。
3. 检查“免费额度用完即停 / Free Quota Only”是否支持，支持则亲自开启并确认生效。
4. 若模型不支持、额度已经耗尽或已过期、开关不能开启：保持公网 AI 关闭，先报告，不能假定免费。
5. 已认证用户若未开启保护，免费额度用完后可能按量收费。开关生效存在延迟，不能开启后立即大量调用。

官方说明：https://help.aliyun.com/zh/model-studio/new-free-quota 。应用的 FREE_QUOTA_CONFIRMED 只是管理员确认记录，无法代替百炼平台开关，也不能读取你的真实余额。当前尚未取得本人免费额度确认，不得设为 true。

## 免费计划与部署

Cloudflare 官方目前说明 SQLite Durable Objects 支持 Workers Free；Pages 需绑定独立 Worker 中定义的 DO。免费计划仍有资源限额；尚未登录核对本账户资源是否可用。若控制台要求付费或升级，停止并反馈，不继续授权或购买。
官方：https://developers.cloudflare.com/durable-objects/ ；https://developers.cloudflare.com/pages/functions/bindings/ 。

未来获发布授权后：先部署关闭状态 Worker（创建 SQLite 迁移），本人填 Secrets与服务配置，再推送 Pages代码，由Git集成部署。先检查两个开关仍关闭的预览，再经单独调用次数/金额授权短测，最后开启生产。先关 Worker 的 PUBLIC_AI_ENABLED 可立即阻止后续新模型请求；已预留且在途的请求可能继续完成、继续占额度。不要删除账本回滚。

## 额度查看

GET /api/quiz-budget，必须 Bearer 管理 Secret，Worker再次验证，只返回累计、每日、金额预留、限额，不返回玩家、题目、答案、IP或 Key。无授权403，无重置路径。不要把管理令牌放浏览器地址栏、截图、前端源码或聊天。使用本机临时安全输入和请求头，见更新发布指南。接口在未部署 / 未配置管理Secret前不可用。

## 验证层级

- 现有UI两人三关：合成人体点+模拟模型，不是真人复测。
- 新云端：Node真实 SQLite 事务模拟DO接口，覆盖限额、并发、重复、故障和判题三态。
- 本地workerd：实际 Worker / SQLite DO bundle，所有外发模型请求由本地outboundService拦截模拟；两人三关12次模拟请求含幂等验证。
- Wrangler dry-run和Pages Functions编译：离线构建，不上传、不是部署。
- 本地真实百炼 / Cloudflare预览真实模型 / 公网真人验收：本轮均未进行。
