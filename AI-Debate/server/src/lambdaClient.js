const axios = require('axios');

const GEMINI_LAMBDA_URL = process.env.GEMINI_LAMBDA_URL;
const BEDROCK_LAMBDA_URL = process.env.BEDROCK_LAMBDA_URL;
const TIMEOUT_MS = 25_000;   // 25 s — history-heavy prompts need more time
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1_500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(err) {
  if (err.code === 'ECONNABORTED') return true;          // timeout
  if (err.code === 'ECONNRESET') return true;             // connection reset
  if (err.code === 'ECONNREFUSED') return true;           // cold-start hiccup
  if (err.response && err.response.status >= 500) return true; // server error
  if (err.response && err.response.status === 429) return true; // rate limited
  return false;
}

async function invokeLambda({ model, persona, topic, myPosition, opponentPosition, history, action }) {
  const url = model === 'gemini' ? GEMINI_LAMBDA_URL : BEDROCK_LAMBDA_URL;
  if (!url) throw new Error(`Lambda URL for model '${model}' is not configured`);

  const payload = { persona, topic, myPosition, opponentPosition, history, action };
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[lambdaClient] retry ${attempt} for ${model}/${action}`);
      await sleep(RETRY_DELAY_MS);
    }
    try {
      const res = await axios.post(url, payload, {
        timeout: TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.data || typeof res.data.content !== 'string') {
        throw new Error('Lambda returned malformed payload');
      }
      if (res.data.content.length === 0) {
        throw new Error('Lambda returned empty content');
      }
      return res.data.content;
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        lastError = new Error(`Lambda timeout (${model}, attempt ${attempt + 1})`);
      } else if (err.response) {
        lastError = new Error(
          `Lambda ${err.response.status} (${model}): ${JSON.stringify(err.response.data)}`
        );
      } else {
        lastError = err;
      }
      // Don't retry client errors (except 429)
      if (!isRetryable(err)) break;
    }
  }
  throw lastError;
}

module.exports = { invokeLambda };
