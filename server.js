'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const API_KEY = process.env.AGNES_API_KEY || '';
const MODEL = process.env.AGNES_MODEL || 'agnes-2.5-flash';
const API_BASE_URL = (process.env.AGNES_API_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/+$/, '');
const HTML_FILE = path.join(__dirname, '今日食选byAkisama.html');
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1000;

class HttpError extends Error {
  constructor(statusCode, message, code = '') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeFoods(context) {
  const foods = Array.isArray(context?.foods) ? context.foods : [];

  return foods
    .slice(0, 50)
    .map(food => ({
      name: cleanText(food?.name, 30),
      emoji: cleanText(food?.emoji, 8),
      desc: cleanText(food?.desc, 160),
      blessing: cleanText(food?.blessing, 80)
    }))
    .filter(food => food.name);
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) throw new HttpError(400, 'messages 必须是数组');

  const normalized = messages
    .filter(message => message && ['user', 'assistant'].includes(message.role))
    .slice(-MAX_MESSAGES)
    .map(message => ({
      role: message.role,
      content: typeof message.content === 'string'
        ? message.content.trim().slice(0, MAX_MESSAGE_LENGTH)
        : ''
    }))
    .filter(message => message.content);

  if (normalized.length === 0 || normalized[normalized.length - 1].role !== 'user') {
    throw new HttpError(400, 'messages 必须以 user 消息结尾');
  }

  return normalized;
}

function buildSystemPrompt(foods) {
  const menu = foods.length > 0
    ? foods.map((food, index) => {
        const emoji = food.emoji ? ` ${food.emoji}` : '';
        const blessing = food.blessing ? `；食签：${food.blessing}` : '';
        return `${index + 1}. ${food.name}${emoji}：${food.desc || '当日推荐'}${blessing}`;
      }).join('\n')
    : '暂无候选列表，请根据用户需求给出一种具体的食物建议。';

  return [
    '你是「今日食签 食神」，一位懂口味、预算、用餐场景和饮食限制的中文美食推荐助手。',
    '请结合最近的对话上下文回答，不要重复询问已经明确的信息。',
    foods.length > 0 ? '只能从下面的候选菜品中选择一道进行推荐，不要推荐候选列表之外的菜。' : '',
    '回复使用自然、简洁、有温度的中文，控制在 120 字以内。',
    '必须严格使用以下三行格式：',
    '推荐你试试【菜名】菜品对应表情',
    '一句推荐理由，说明它为何适合用户。',
    '「一句应景的食运祝福」',
    '',
    '候选菜品：',
    menu
  ].filter(Boolean).join('\n');
}

async function requestAgnes(payload) {
  if (!API_KEY) {
    throw new HttpError(
      503,
      'Agnes API 尚未配置，请设置 AGNES_API_KEY 环境变量。',
      'DEEPSEEK_NOT_CONFIGURED'
    );
  }

  const foods = normalizeFoods(payload?.context);
  const messages = normalizeMessages(payload?.messages);
  // 模型必须由服务端控制，避免客户端传入高成本或非预期模型。
  const model = MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(foods) },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 500,
        stream: false
      }),
      signal: controller.signal
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new HttpError(502, 'Agnes 返回了无法解析的响应', 'INVALID_UPSTREAM_RESPONSE');
    }

    if (!response.ok) {
      const upstreamMessage = cleanText(data?.error?.message, 240);
      throw new HttpError(
        502,
        upstreamMessage || `Agnes 请求失败（${response.status}）`,
        'UPSTREAM_REQUEST_FAILED'
      );
    }

    const reply = typeof data?.choices?.[0]?.message?.content === 'string'
      ? data.choices[0].message.content.trim()
      : '';

    if (!reply) {
      throw new HttpError(502, 'Agnes 未返回有效内容', 'EMPTY_UPSTREAM_REPLY');
    }

    const foodName = foods.find(food => reply.includes(food.name))?.name || null;

    return {
      provider: 'agnes',
      model: data.model || model,
      reply,
      foodName
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new HttpError(504, 'Agnes 响应超时，请稍后重试。', 'UPSTREAM_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, '请求体过大', 'PAYLOAD_TOO_LARGE');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, '请求体不是有效的 JSON', 'INVALID_JSON');
  }
}

async function handleChat(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: '仅支持 POST 请求' });
    return;
  }

  try {
  const payload = await readJsonBody(request);
  const result = await requestAgnes(payload);
    sendJson(response, 200, result);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof HttpError ? error.message : '服务器内部错误';
    const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';

    if (!(error instanceof HttpError)) console.error(error);
    sendJson(response, statusCode, { error: message, code, fallback: true });
  }
}

async function servePage(response) {
  try {
    const html = await fs.promises.readFile(HTML_FILE);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': html.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(html);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('无法读取页面文件。');
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      provider: 'agnes',
      model: MODEL,
      agnesConfigured: Boolean(API_KEY)
    });
    return;
  }

  if (url.pathname === '/api/chat') {
    await handleChat(request, response);
    return;
  }

  if (request.method === 'GET' && (url.pathname === '/' || decodeURIComponent(url.pathname) === `/${path.basename(HTML_FILE)}`)) {
    await servePage(response);
    return;
  }

  if (url.pathname === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`今日食选已启动：http://${HOST}:${PORT}`);
  console.log(`Agnes API：${API_KEY ? `已配置（${MODEL}）` : '未配置，前端将使用本地降级模式'}`);
});
