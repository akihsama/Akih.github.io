// 问食神 agent 后端（Cloudflare Worker）
// 部署后暴露一个 POST 接口，替静态站（GitHub Pages）安全调用 DeepSeek，
// 把 API Key 藏在服务端，并按「每天 1 元」额度用 Cloudflare KV 记账限流。
// 详见同目录 README.md。

// ===== 可配置项 =====
const DAILY_BUDGET_YUAN = 1.00;                // 每天预算（元）
const INPUT_RATE_YUAN_PER_M = 2;               // DeepSeek 输入价（元/百万 token），保守取值
const OUTPUT_RATE_YUAN_PER_M = 8;              // DeepSeek 输出价（元/百万 token），保守取值
const DAILY_MAX_CALLS = 500;                   // 兜底：每天最多调用次数
const ALLOWED_ORIGIN = "https://akihsama.github.io"; // 前端站点来源（CORS 白名单）
const MICRO_PER_YUAN = 1000000;                // 微元 = 1/1000000 元，避免浮点误差

addEventListener("fetch", (event) => {
  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405, corsHeaders);
    }

    const origin = request.headers.get("origin") || "";
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: "cors: origin not allowed" }, 403, corsHeaders);
    }

    // 按 UTC 天分桶
    const day = new Date().toISOString().slice(0, 10);
    const spendKey = "spend-" + day;
    const callKey = "calls-" + day;
    const spentMicro = Number((await env.SPEND.get(spendKey)) || 0);
    const calls = Number((await env.SPEND.get(callKey)) || 0);

    if (spentMicro >= DAILY_BUDGET_YUAN * MICRO_PER_YUAN || calls >= DAILY_MAX_CALLS) {
      return json({ error: "今日额度已用完，明天再来问食神吧 🍜" }, 429, corsHeaders);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "invalid JSON body" }, 400, corsHeaders); }

    const model = (body && body.model) || "deepseek-chat";
    const userMessages = Array.isArray(body && body.messages) ? body.messages : [];
    const currentFood = (body && body.context && body.context.currentFood) || null;
    const menuNames = ((body && body.context && body.context.foods) || []).map(function (f) { return f.name; });

    let systemPrompt =
      "你是「今日食签」的食神，一个懂吃、风趣、会安慰人的美食顾问。" +
      "请根据用户的描述推荐一道最适合吃的食物；优先从菜单里选：" +
      (menuNames.length ? menuNames.join("、") : "（无菜单限制，自由发挥）") +
      (currentFood ? " 用户刚摇到的签是【" + currentFood.name + "】，可参考。" : "") +
      " 请在回复中用【菜名】标出你推荐的菜，并在末尾加一句简短签语。口语化，不超过 80 字。";

    const deepseekBody = {
      model: model,
      messages: [{ role: "system", content: systemPrompt }].concat(
        userMessages.slice(-6).map(function (m) {
          return { role: (m.role === "assistant" ? "assistant" : "user"), content: String(m.content || "") };
        })
      ),
      temperature: 0.8,
      max_tokens: 200,
    };

    let ds;
    try {
      ds = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + (env.DEEPSEEK_API_KEY || ""),
        },
        body: JSON.stringify(deepseekBody),
      });
    } catch (e) {
      return json({ error: "DeepSeek 请求失败：" + e.message }, 502, corsHeaders);
    }

    if (!ds.ok) {
      const t = await ds.text();
      return json({ error: "DeepSeek 返回错误 " + ds.status, detail: t }, 502, corsHeaders);
    }

    const data = await ds.json();
    const reply = (((data.choices || [])[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;

    // 记账（微元）
    const costMicro = promptTokens * INPUT_RATE_YUAN_PER_M + completionTokens * OUTPUT_RATE_YUAN_PER_M;
    await Promise.all([
      env.SPEND.put(spendKey, String(spentMicro + costMicro)),
      env.SPEND.put(callKey, String(calls + 1)),
    ]);

    const foodMatch = reply.match(/【([^】]{1,24})】/);
    return json({
      reply: reply,
      foodName: foodMatch ? foodMatch[1] : undefined,
      provider: "deepseek",
      model: model,
      usage: {
        promptTokens: promptTokens,
        completionTokens: completionTokens,
        costYuan: Number((costMicro / MICRO_PER_YUAN).toFixed(4)),
      },
    }, 200, corsHeaders);
}

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {}),
  });
}
