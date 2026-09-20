# 今日食选

页面字体统一使用系统行楷字体栈，优先匹配 `STXingkai / 华文行楷`，并提供楷体等兼容回退。

## 启动

需要 Node.js 18 或更高版本。项目不依赖第三方 npm 包。

```powershell
# 可选：不配置密钥时，页面会自动使用本地推荐逻辑
node server.js
```

配置 Agnes：

```powershell
$env:AGNES_API_KEY = "sk-你的密钥"
$env:AGNES_MODEL = "agnes-2.5-flash"
node server.js
```

然后访问 `http://127.0.0.1:3000`。API 密钥只保存在服务端环境变量中，不会发送到浏览器。

## 后端接口

`POST /api/chat`

请求：

```json
{
  "provider": "agnes",
  "model": "agnes-2.5-flash",
  "messages": [
    { "role": "user", "content": "今天想吃点清淡的" }
  ],
  "context": {
    "foods": [
      {
        "name": "海鲜粥",
        "emoji": "🥣",
        "desc": "鲜甜海鲜熬煮的绵密粥品，温润滋养",
        "blessing": "温润如玉，养生之道"
      }
    ],
    "currentFood": null
  }
}
```

响应：

```json
{
  "provider": "agnes",
  "model": "agnes-2.5-flash",
  "reply": "推荐你试试【海鲜粥】🥣\n\n鲜甜温润，适合想吃清淡一点的你。\n\n「温润如玉，养生之道」",
  "foodName": "海鲜粥"
}
```

接口异常时返回 `{ "error": "...", "code": "...", "fallback": true }`，前端会自动切换到本地推荐。

## 可用环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `AGNES_API_KEY` | 空 | Agnes API 密钥 |
| `AGNES_MODEL` | `agnes-2.5-flash` | Agnes 模型 |
| `AGNES_API_BASE_URL` | `https://apihub.agnes-ai.com` | Agnes API 地址 |
| `HOST` | `127.0.0.1` | 服务监听地址 |
| `PORT` | `3000` | 服务端口 |
