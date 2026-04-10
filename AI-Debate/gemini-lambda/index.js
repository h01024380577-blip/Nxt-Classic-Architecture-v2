const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildPrompt } = require('./prompts');

// gemini-2.0-flash: 1,500 req/day free tier (vs 20 for 2.5-flash).
// Override via GEMINI_MODEL env var if a paid plan is available.
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[gemini-lambda] GEMINI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MAX_RETRIES = 2;
const RETRY_DELAYS = [2_000, 5_000]; // ms — backoff for retries

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  const msg = err.message || '';
  return msg.includes('429') || msg.includes('503') || msg.includes('overloaded');
}

exports.handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || event);
    const { system, user } = buildPrompt(body);

    if (!genAI) {
      return jsonResponse(500, { error: 'GEMINI_API_KEY not configured' });
    }

    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: system,
    });

    const genConfig = { temperature: 0.85, maxOutputTokens: 2048 };
    // Disable Gemini 2.5's internal thinking budget so the full
    // maxOutputTokens goes to the visible response. For 2.0 models
    // this field is harmlessly ignored.
    if (MODEL_ID.includes('2.5')) {
      genConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    let result;
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[gemini-lambda] retry ${attempt} after ${RETRY_DELAYS[attempt - 1]}ms`);
          await sleep(RETRY_DELAYS[attempt - 1]);
        }
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: genConfig
        });
        break; // success
      } catch (err) {
        lastErr = err;
        if (!isRetryableError(err) || attempt === MAX_RETRIES) throw err;
      }
    }

    const candidate = result.response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    // Extract visible text. text() throws if there are no candidates —
    // fall back to manually extracting parts.
    let content = '';
    try {
      content = result.response.text().trim();
    } catch {
      const parts = candidate?.content?.parts || [];
      content = parts.map(p => p.text || '').join('').trim();
    }

    if (!content) {
      console.error('[gemini-lambda] empty response', { finishReason, candidate });
      return jsonResponse(500, { error: `Empty response from model (finishReason: ${finishReason})` });
    }

    if (finishReason && finishReason !== 'STOP') {
      console.warn('[gemini-lambda] non-STOP finish', {
        finishReason,
        length: content.length,
        preview: content.slice(0, 60)
      });
    }
    return jsonResponse(200, { content });
  } catch (err) {
    console.error('[gemini-lambda] error', err);
    return jsonResponse(500, { error: err.message || 'Lambda failure' });
  }
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}
