> 正式开放准备更新（2026-10-30）：用户已授权启用AI及最高5元内部预留，真实冒烟最多2次、不自动重试；先预览验证再合并master。下文默认关闭值属于首次安全部署步骤。后续前端修改可按本地测试→Git提交→push master自动更新Pages；如果修改server/或cloudflare/，还需发布独立Worker，不能声称Pages推送会自动更新Worker。当前没有配置Worker的Git集成；为保持密钥安全，不把Wrangler OAuth上传GitHub。模型价格核对日期超过7天会停用，需本人重新核对价格后更新配置。

# 以后如何更新并发布 GymGoGo

本指南对应 D:\gymgogogo、master 分支、已有 GitHub 仓库和 gymgogo.pages.dev。命令是未来获得发布授权后由你执行的步骤，本轮没有执行提交、推送、部署或真实模型调用。

## 1. 启动本地与查看修改

在项目目录打开 PowerShell：

```powershell
cd D:\gymgogogo
npm ci
npm run dev
```

已安装且依赖没变时只需 npm run dev。打开 http://127.0.0.1:5173/，保存前端代码会自动更新。终端按 Ctrl+C 停止。端口占用时先找到原来的终端，不能随意结束所有 Node 进程。

修改模型地址、Key、模型名称或服务端配置后，停止再运行 npm run dev。配置只放 .env.local，不用 VITE_ 前缀。原百炼变量继续兼容；详见《AI服务配置说明》。检查页面服务状态不请求模型，进入实际出题或提交判题才可能消耗额度，必须先确认真实调用预算。

## 2. 发布前检查

```powershell
cd D:\gymgogogo
npm run typecheck
npm test -- --maxWorkers=1
npm run build
npm run check:cloud
```

最后一条只离线检查 Worker 和 Pages Functions，不部署、不调用模型。首次测试需要 Node.js 22.14 或更高兼容版本，测试使用 node:sqlite，可能显示实验特性提醒。Miniflare / Wrangler 为开发工具，不是开通付费服务。

npm run preview 可以查看生产前端，不能代替已绑定云端的问答验证。普通模型测试全是模拟；不要把测试通过写成公网真人已通过。

## 3. Git 和 GitHub 的区别

Git 是本机版本记录，GitHub 是网上远程仓库；git commit 不会自动上传，git push 才会上传。Cloudflare 读取 GitHub 后构建网站，因此推送 master 可能触发自动部署。

```powershell
git status
git branch --show-current
git remote -v
git diff --stat
```

应为 master，origin 指向 https://github.com/2033124642rose-create/GymGoGo.git。若出现 dubious ownership，先核对确实是自己的 D:\gymgogogo，再使用本次命令形式 `git -c safe.directory=D:/gymgogogo status`；不要对所有目录开放信任。

## 4. 选择本次文件并本地提交

- git status：看修改、未追踪、暂存情况。
- git add：选定下一次要记录的文件，不是上传。
- git commit：在本机创建一个版本。
- git push：把本机版本传到已有 GitHub。

先审查文件，不直接照搬 git add .。本次云端改造涉及已有未提交问答、语音、产品包装及新云端目录，必须一并确认完整性；不能只上传云端两三个文件。

选定文件示例（先确认内容安全）：

```powershell
git add src server functions cloudflare scripts tests docs README.md index.html package.json package-lock.json wrangler.jsonc .gitignore .env.example
git diff --cached --stat
git diff --cached --check
```

这条是候选发布清单，不替代逐项审核。不要暂存 .env.local、.dev.vars、.local、.wrangler、node_modules、dist 或 .npm-cache，不要使用 git add -f 绕过忽略。docs/evidence 的图片也要亲自检查是否包含真人隐私或控制台密钥；自动文本扫描不认识图片中的字。

确认后：

```powershell
git commit -m "feat: prepare cloud AI quiz with durable global budgets"
```

本轮尚未创建此提交。需要时先 git log --oneline -5 确认已有提交，不能把旧提交当作新版。

## 5. 首次发布云端后端（必须先获授权）

先完成《Cloudflare公网AI部署与预算》的免费额度及控制台检查。若出现购买、升级付费套餐，停止，不接受。

```powershell
cd D:\gymgogogo
npx wrangler login
npx wrangler deploy --config cloudflare/wrangler.jsonc
```

login 由你亲自登录 Cloudflare 并核对账号，deploy 是真正部署，和 dry-run 完全不同。初次创建 SQLite Durable Object 及迁移，workers.dev 保持关闭，不手动增加公开路由。固定对象名及存储命名空间不能改，否则会变成一份新账本。

随后亲自在 Cloudflare Worker gymgogo-quiz-service 的设置中填写：

- Secret：AI_API_KEY、SOURCE_HASH_SECRET、QUIZ_ADMIN_TOKEN。后两项用至少32字符的随机值，不发到聊天。
- 非敏感变量：模型/地址、价格、价格日期、四类次数、允许的总预留金额等。
- PUBLIC_AI_ENABLED、FREE_QUOTA_CONFIRMED 暂时保持 false。费用预算默认0，必须确认金额后才设非零。

也可由你用 `npx wrangler secret put AI_API_KEY --config cloudflare/wrangler.jsonc` 在安全提示中填写，不把完整 Key 放命令参数或日志。修改非敏感配置最好同步维护已审查的 Worker 配置文件，否则下次发布可能覆盖控制台设置。Secret 不写入配置文件。

## 6. 上传已有 GitHub 仓库和更新 Pages

后端已部署关闭状态、绑定目标存在，审查和授权完成后：

```powershell
cd D:\gymgogogo
git push origin master
```

弹出 GitHub 登录/授权时由你完成。不要 force push，不新建同名仓库。

Cloudflare Workers & Pages → gymgogo 项目 → 部署，确认关联仓库、生产分支 master、构建命令 npm run build、输出 dist。根 wrangler.jsonc 包含 QUIZ_SERVICE 服务绑定，生产/预览都指向同一个预算 Worker，两个环境开关分别控制。

Pages只需要服务绑定和 PUBLIC_AI_ENABLED，若要查看管理额度，还需同一 QUIZ_ADMIN_TOKEN Secret；不要在 Pages 填模型Key，也不要填 VITE_AI_API_KEY。部署配置以仓库文件为准，控制台提示配置冲突时先核对，不盲目覆盖。

先检查预览页面在关闭状态可以使用纯运动模式。经独立授权少量真实调用后，才启用 Worker 与目标 Pages 的 PUBLIC_AI_ENABLED，并在本人确认百炼保护生效后设置 FREE_QUOTA_CONFIRMED=true。预览真实调用也计入同一个1000次总账本，不另领额度。

## 7. 查看成功和失败

部署页显示成功后，核对提交编号，再打开对应预览 / 正式URL，检查摄像头权限和实际问答。编译成功不等于模型授权或额度正常。失败时看构建日志，分享错误之前先遮住Key、令牌和个人信息，不贴请求头或整个环境文件。

Worker与Pages分开部署：只推GitHub不能自动发布独立Worker，除非未来明确配置Worker的Git集成。本项目当前仅准备手动Wrangler发布Worker。

## 8. 以后更换公网模型

在 Worker 服务端修改 AI_PROVIDER / AI_BASE_URL / AI_MODEL 及对应 Secret，核对并绑定价格。旧百炼变量只作兼容，优先新变量。别改前端，不向Pages暴露Key。关闭AI后改配置、发布Worker，再获授权少量验证；原预算不清零。设置切换不能绕过本次已授权次数或金额。

## 9. 安全查看额度

未来部署并配置管理Secret后，本机PowerShell可临时安全输入管理令牌：

```powershell
$gymAdminSecure = Read-Host "输入管理令牌（不显示）" -AsSecureString
$gymAdminPlain = [System.Net.NetworkCredential]::new('', $gymAdminSecure).Password
try {
  Invoke-RestMethod 'https://gymgogo.pages.dev/api/quiz-budget' -Headers @{ Authorization = "Bearer $gymAdminPlain" }
} finally {
  Remove-Variable gymAdminPlain, gymAdminSecure -ErrorAction SilentlyContinue
}
```

这是你的管理令牌，不是百炼Key。不要截图输入过程或把令牌发给朋友。接口只查看计数、预留金额和限制，不会调用模型，也没有重置按钮。403表示缺少或错误授权。控制台日志不能当可靠全局账本。

## 10. 回滚

发现费用异常先关闭 Worker 的 PUBLIC_AI_ENABLED，必要时撤销百炼Key，停止新增调用；在途调用可能继续完成并占额度。保留预算存储。

- Pages：在部署列表选择上一个已确认正常的生产部署，使用平台回滚入口。先核对环境，回滚后再检查。
- GitHub：用 git log 找到问题提交，`git revert <问题提交编号>` 产生反向修复提交，审核后正常 push。复杂的合并提交先求助，不能用 reset + force push 覆盖公共历史。
- Worker：通过 Cloudflare 版本/部署管理选择兼容的前版，或恢复代码正常发布。不得删除DO命名空间，或回滚到不识别现有账本格式的版本；预算数据不能随应用回滚清零。

## 11. 常见问题

- 5173占用：停止原Vite终端再开，不删除项目或结束全部Node。
- 本地正常公网禁用：检查两个公网开关、免费保护确认、价格有效日期、Worker Key、服务绑定；不是把VITE变量改成true。
- 免费额度没了：保持AI关闭，核对百炼用完即停；不要购买或关闭保护来“修复”。
- rate_limited：来源一分钟达到10次，等一分钟后手动重试，不自动循环。
- budget_exhausted：累计/每日/来源或费用预留上限已到；不要删账本或重建DO。
- store_unavailable：存储校验失败，服务停止调用；先排查，不能切换内存模式。
- model_timeout：结果不确定仍计额度，同操作不自动重发；按页面提示处理。
- Wrangler目录权限错误：离线检查使用 npm run check:cloud，会将日志和配置缓存放项目 .npm-cache。实际部署如仍遇到权限问题，先检查目录权限，不关闭系统保护。
- 控制台要求付费升级：停止并反馈，不自行接受。

真实模型、预览环境与正式公网真人验收应分别记录，不能用模拟截图或本地成功替代。


## 本次正式上线结果（2026-10-30）

已完成预览真实qwen-flash出题/判题各1次并发布生产 https://gymgogo.pages.dev/ 。主功能发布提交35f2850，后续归档提交仅更新文档。推送master会自动更新Pages；独立Worker修改仍需按上述命令部署，尚未配置Worker自动Git集成。免费保护由本人确认，价格核对日期超过7天仍会安全停用，需重新核对后更新，不得盲目刷新日期。
