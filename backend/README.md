# 问食神 Agent 后端（Cloudflare Worker）

这套后端替静态站（GitHub Pages）安全调用 DeepSeek：API Key 藏在 Worker 里（不进 Git），
并按「每天 1 元」额度自动限流（用量记账在 Cloudflare KV，跨部署共享）。

## 文件
- worker.js       后端逻辑：调 DeepSeek + 每天 1 元限流 + CORS
- wrangler.toml   Worker 配置（KV 命名空间）

## 前置
1. 一个 Cloudflare 账号（免费版即可，Worker 有免费额度）
2. 一个 DeepSeek API Key（在 https://platform.deepseek.com 申请，账户需有余额）
3. 安装 wrangler：  npm i -g wrangler

## 部署步骤（都在 backend/ 目录执行）
1. 登录：              wrangler login
2. 建 KV 命名空间：     wrangler kv:namespace create spend
   会打印 "id: xxxxxxxxxx"，把 wrangler.toml 里的 PASTE_YOUR_KV_NAMESPACE_ID 换成它。
3. 填 DeepSeek Key（作为机密，不进仓库）：
   wrangler secret put DEEPSEEK_API_KEY
   回车后粘贴你的 key（输入不回显）。
4. 部署：              wrangler deploy
   成功后会给一个地址，形如  https://shiqian-agent.<你的子域>.workers.dev

## 接入前端
把上一步的地址填进站点 app/index.html 顶部这一行（留空则自动降级本地食神）：
   const AGENT_ENDPOINT = 'https://shiqian-agent.<你的子域>.workers.dev';
然后提交并推送站点。

## 「每天 1 元」限流是怎么做的
- 每次调 DeepSeek 后，按  输入价×输入token + 输出价×输出token  折算成钱，
  累加进 KV 里以日期为键的计数器（spend-YYYY-MM-DD，UTC 天）。
- 价格取保守值（输入 2 元/百万 token、输出 8 元/百万 token），宁可提前用完也不超支。
- 当天累计 >= 1 元，或调用 >= 500 次，后续请求返回 429「今日额度已用完」。
- 想调额度/价格/次数：改 worker.js 顶部的 DAILY_BUDGET_YUAN、*_RATE_YUAN_PER_M、DAILY_MAX_CALLS，
  再 wrangler deploy。

## 安全提示
- 绝不要把 DeepSeek Key 提交到 Git。Key 用 wrangler secret 存在 Cloudflare，只在你的机器和 Cloudflare 里。
- worker.js 里 ALLOWED_ORIGIN 已写死为你站点域名；换域名记得同步改。

## 常见问题
- 调 401/403：DeepSeek key 没填对，或 Cloudflare 到 DeepSeek 的访问受限。
- 前端一直是本地食神：AGENT_ENDPOINT 没填，或 Worker 的 ALLOWED_ORIGIN 与站点域名不一致。
- 想只用本地食神、不花一分钱：把 AGENT_ENDPOINT 留空即可。
