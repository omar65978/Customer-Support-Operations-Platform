const jsonServer = require('json-server');
const auth = require('json-server-auth');
const cors = require('cors');
const path = require('path');

const app = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults({ noCors: true });

app.db = router.db;

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(middlewares);

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getTokenFromRequest(req) {
  const header = req.headers['authorization'] || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

app.use((req, res, next) => {
  const publicPaths = ['/login', '/register'];
  if (publicPaths.some((p) => req.path === p)) return next();

  const token = getTokenFromRequest(req);
  if (!token) return next();

  const payload = decodeJwt(token);
  if (!payload) return next();

  const role = payload.role;
  const sub = payload.sub;

  if (req.path.startsWith('/requests')) {
    const idMatch = req.path.match(/^\/requests\/([^/]+)$/);

    if (role === 'agent') {
      if (idMatch) {
        const id = idMatch[1];
        const db = router.db.get('requests').value();
        const record = db.find((r) => String(r.id) === String(id));
        if (!record) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (String(record.assignedAgentId) !== String(sub)) {
          return res.status(403).json({ error: 'Forbidden: this request is not assigned to you' });
        }
      } else if (req.method === 'GET' && req.path === '/requests') {
        const original = res.json.bind(res);
        res.json = function(data) {
          if (Array.isArray(data)) {
            return original(data.filter((r) => String(r.assignedAgentId) === String(sub)));
          }
          return original(data);
        };
      }
    }

    if (role === 'customer') {
      if (idMatch) {
        const id = idMatch[1];
        const db = router.db.get('requests').value();
        const record = db.find((r) => String(r.id) === String(id));
        if (!record) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (String(record.customerId) !== String(sub)) {
          return res.status(403).json({ error: 'Forbidden: this request does not belong to you' });
        }
      } else if (req.method === 'GET' && req.path === '/requests') {
        const original = res.json.bind(res);
        res.json = function(data) {
          if (Array.isArray(data)) {
            return original(data.filter((r) => String(r.customerId) === String(sub)));
          }
          return original(data);
        };
      }
    }
  }

  if (req.path.startsWith('/messages') && req.method === 'GET') {
    if (role === 'customer') {
      const original = res.json.bind(res);
      res.json = function(data) {
        if (Array.isArray(data)) {
          return original(data.filter((m) => !m.isInternal));
        }
        return original(data);
      };
    }
  }

  next();
});

app.use(
  auth.rewriter({
    users: 640,
    requests: 640,
    messages: 640,
  })
);

app.use(auth);
app.use(router);

const PORT = process.env.PORT || 3001;
app.listen(PORT);