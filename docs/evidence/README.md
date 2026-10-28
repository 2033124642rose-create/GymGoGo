# 验证素材

按 `日期-阶段-内容` 命名。仅保存真实执行产生的截图、短视频或脱敏结果。

- `2026-10-27-phase1-desktop.jpg`：第一阶段桌面首页，待开始状态。
- `2026-10-27-phase1-mobile.jpg`：第一阶段 390 × 844 视口完整页面，待开始状态。
- `2026-10-28-monster-damage-desktop.jpg`：首轮反馈调整后，1920px 视口、第 7 次模拟攻击，怪兽累积伤痕和表情变化。
- `2026-10-28-playful-desktop.jpg`：第二轮反馈调整，1440px 桌面，放大后的冒险卡片与 4 HIT 反馈。
- `2026-10-28-playful-mobile-guide.jpg`：390px 窄屏指南视口，检查实际文字与卡片布局。
- `2026-10-28-forest-story-desktop.jpg`：第三轮反馈后 1440px 桌面，居中大标题与统一森林营地视觉。
- `2026-10-28-forest-story-mobile-hero.jpg`：390px 手机首屏，主次标题与森林场景。
- `2026-10-28-phase2-camera-idle-desktop.jpg`：第二阶段摄像头默认关闭的完整桌面页面。
- `2026-10-28-phase2-camera-idle-mobile.jpg`：390px 营地与模拟游戏分区，不包含真人画面。
- `2026-10-28-phase2-real-model-smoke.jpg`：真实 MediaPipe Worker 对程序生成空白帧的推理结果，不使用摄像头。
- `2026-10-28-training-screen-desktop.jpg`：UX-001 训练大屏，1440px 桌面、摄像头关闭。
- `2026-10-28-training-screen-mobile.jpg`：UX-001 训练大屏，390px 视口、摄像头关闭。
- `2026-10-28-battle-screen-desktop.jpg`：修订后的战斗大屏，1440px，模拟 3 / 10、摄像头关闭。
- `2026-10-28-battle-screen-laptop.jpg`：1366 × 768 笔记本布局，双区与巨大计数。
- `2026-10-28-battle-screen-mobile.jpg`：390px 双区战斗布局，非真人画面。
- `2026-10-28-phase3-real-mode-idle.jpg`：第三阶段默认真实模式，未开启摄像头，计数 0。
- `2026-10-28-phase3-real-mode-laptop.jpg`：1366px 第三阶段真实模式待开始布局。
- `2026-10-28-phase3-real-mode-mobile.jpg`：390px 第三阶段模式切换与待开始布局。
- `2026-10-28-phase3-demo-victory.jpg`：第三阶段按钮演示回归通关，非真人计数证明。

截图来自真实浏览器页面，仅证明当时原型展示，不代表用户已认可最终风格。

不要提交密钥、个人身份信息、含私人路径的完整日志或未经同意的摄像头画面。

- 2026-10-28-phase3-waiting-ready.jpg：UX-004 无接触自动开局的等待就位战斗大屏，未开启摄像头，0 次 / 100HP；不代表真人倒计时或动作验收。

- 2026-10-28-phase3-ready-debug.jpg：UX-005 临时就位调试面板，摄像头未开启，无真人图像；仅证明诊断界面可用。

- 2026-10-28-phase4-demo-settlement.png：1280×720 大屏演示结算，不含真人影像，不代表真实 AI 返回。
- 2026-10-28-phase4-mobile-settlement.png：390×844 窄屏演示结算，允许结算区域内滚动，无页面横向溢出。

- 2026-10-28-phase4-bailian-smoke.json：一次真实百炼生成请求返回 HTTP 403，本地备用正常；使用合成结算测试数据，未包含 Key，也不代表真人记录或生成成功。

- 2026-10-28-phase4-bailian-diagnostic.json：第二次用户授权的一次生成联调，403 access_denied，确认为 API-Key 模型访问范围限制；不含 Key。

- 2026-10-28-phase4-bailian-permission-retest.json：用户修正模型权限后一次真实生成请求成功，HTTP 200、source=ai，测试数据为合成 10 次 / 75 秒，不包含 Key。
