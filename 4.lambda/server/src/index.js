// IMPORTANT: dotenv must load BEFORE requiring lambdaClient (which reads process.env at import time).
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createRouter } = require('./routes/debate');
const { invokeLambda } = require('./lambdaClient');
const db = require('./db');
const { expireOlderThan } = require('./sessions');

const PORT = process.env.PORT || 4000;
const ONE_HOUR = 60 * 60 * 1000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/debate', createRouter({ invokeLambda, db }));

// Periodic session cleanup
setInterval(() => expireOlderThan(ONE_HOUR), 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
