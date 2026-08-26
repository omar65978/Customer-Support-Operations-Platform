const jsonServer = require('json-server');
const auth = require('json-server-auth');
const cors = require('cors');
const path = require('path');
const express = require('express');

const app = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults({ noCors: true });

app.db = router.db;

app.use(cors({ origin: true, credentials: true }));
app.use(middlewares);
app.use(jsonServer.bodyParser);

function decodeJwt(token) {
  try {
    const b64 = token.split('.')[1];
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function getDbUser(sub) {
  return router.db.get('users').find({ id: sub }).value();
}

function getUserFromReq(req) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) return null;
  const payload = decodeJwt(header.slice(7));
  if (!payload) return null;
  return getDbUser(payload.sub);
}

app.use(
  auth.rewriter({
    users: 640,
    requests: 640,
    messages: 640,
  })
);

app.use(auth);

app.get('/requests', (req, res, next) => {
  const user = getUserFromReq(req);
  if (!user) return next();

  const allRequests = router.db.get('requests').value();
  let filtered = allRequests;

  const queryParams = { ...req.query };

  if (user.role === 'agent') {
    filtered = filtered.filter((r) => String(r.assignedAgentId) === String(user.id));
  } else if (user.role === 'customer') {
    filtered = filtered.filter((r) => String(r.customerId) === String(user.id));
  }

  Object.entries(queryParams).forEach(([key, val]) => {
    if (key.startsWith('_')) return;
    if (key.endsWith('_like')) {
      const field = key.replace('_like', '');
      filtered = filtered.filter((r) => r[field] && String(r[field]).toLowerCase().includes(String(val).toLowerCase()));
    } else {
      filtered = filtered.filter((r) => String(r[key]) === String(val));
    }
  });

  const sort = queryParams._sort;
  const order = queryParams._order || 'asc';
  if (sort) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[sort] || '';
      const bv = b[sort] || '';
      return order === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
  }

  return res.json(filtered);
});

app.get('/requests/:id', (req, res, next) => {
  const user = getUserFromReq(req);
  if (!user) return next();

  const record = router.db.get('requests').find({ id: req.params.id }).value();
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (user.role === 'agent' && String(record.assignedAgentId) !== String(user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user.role === 'customer' && String(record.customerId) !== String(user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json(record);
});

app.get('/messages', (req, res) => {
  const user = getUserFromReq(req);
  let messages = router.db.get('messages').value();

  if (req.query.requestId) {
    messages = messages.filter((m) => String(m.requestId) === String(req.query.requestId));
  }

  if (user && user.role === 'customer') {
    messages = messages.filter((m) => !m.isInternal);
  }

  return res.json(messages);
});

app.use(router);

const PORT = process.env.PORT || 3001;
app.listen(PORT);