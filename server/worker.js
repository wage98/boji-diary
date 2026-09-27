/* ============================================================
   薄肌日记 · AI 食物识别代理（Cloudflare Worker）
   ------------------------------------------------------------
   为什么要有它：视觉大模型的 API Key 不能写在前端（仓库是公开的，
   任何人打开 DevTools 就能抄走）。这一层只做三件事：
     1. 校验访问口令（ACCESS_TOKEN），拒绝陌生人刷你的额度
     2. 把图片转发给视觉大模型，拿回结构化 JSON
     3. 统一返回 { ok, data } / { ok:false, error }
   它不保存任何图片、不保存任何用户数据 —— 请求结束即丢弃。

   部署：见同目录 README.md（免费额度足够个人使用）
   ============================================================ */

const PROVIDERS = {
  // 智谱 GLM-4V 系列：视觉模型永久免费、OpenAI 兼容、大陆直连（推荐）
  zhipu:  { base: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', key: 'ZHIPU_KEY',    model: 'glm-4v-flash' },
  openai: { base: 'https://api.openai.com/v1/chat/completions',             key: 'OPENAI_KEY',   model: 'gpt-4o-mini' },
  custom: { base: null,                                                     key: 'CUSTOM_KEY',   model: null },   // base 用 OPENAI_BASE
};

const PROMPT =
  '你是营养估算助手。识别图中的食物，估算这一份可食部分的重量与营养。' +
  '只输出一行 JSON，不要解释、不要 Markdown 代码块：' +
  '{"name":"中文名20字内","grams":数字,"kcal":数字,"protein":蛋白克,"carb":碳水克,"fat":脂肪克,"confidence":0到1,"uncertain":false}\n' +
  '规则：数值都是这一份的总量（不是每100g）；图中不是食物或看不清时 uncertain=true 且 confidence<=0.3。';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS),
});

function extractJSON(text) {
  const s = String(text == null ? '' : text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ ok: false, error: '仅支持 POST' }, 405);
    if (url.pathname !== '/recognize') return json({ ok: false, error: '接口不存在' }, 404);

    // 1) 访问口令校验：没配 ACCESS_TOKEN 时拒绝全部请求（防止被白嫖）
    let body = null;
    try { body = await request.json(); } catch (e) { return json({ ok: false, error: '请求体不是合法 JSON' }, 400); }
    if (!env.ACCESS_TOKEN) return json({ ok: false, error: '服务端未配置 ACCESS_TOKEN' }, 500);
    if (String(body.token || '') !== env.ACCESS_TOKEN) return json({ ok: false, error: '访问口令不正确' }, 401);

    const image = String(body.image || '');
    if (image.length < 200 || image.length > 6 * 1024 * 1024) return json({ ok: false, error: '图片数据异常' }, 400);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(image)) return json({ ok: false, error: '图片编码非法' }, 400);

    // 2) 选provider
    const pname = (env.PROVIDER || 'zhipu').toLowerCase();
    const p = PROVIDERS[pname] || PROVIDERS.zhipu;
    const apiKey = env[p.key];
    const base = p.base || env.OPENAI_BASE;
    if (!apiKey || !base) return json({ ok: false, error: '服务端未配置 ' + p.key + ' / OPENAI_BASE' }, 500);
    const model = String(body.model || p.model || 'glm-4v-flash');

    // 3) 调视觉大模型（OpenAI 兼容格式）
    const payload = {
      model,
      temperature: 0.2,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + image } },
        { type: 'text', text: PROMPT },
      ] }],
    };
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify(payload),
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(25000) : undefined,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) return json({ ok: false, error: '模型服务返回 ' + r.status + ' ' + (j && j.error && j.error.message ? j.error.message : '') }, 502);
      const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(x => x.text || '').join('') : '');
      const data = extractJSON(text);
      if (!data) return json({ ok: false, error: '模型返回无法解析' }, 502);
      return json({ ok: true, data });
    } catch (e) {
      return json({ ok: false, error: '调用模型失败：' + (e && e.message ? e.message : '未知错误') }, 502);
    }
  },
};
