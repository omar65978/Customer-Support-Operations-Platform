const jsonServer = require('json-server');
const auth = require('json-server-auth');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('File type not allowed'));
  },
});

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

function canAccessRequest(user, record) {
  if (!user || !record) return false;
  if (user.role === 'manager') return true;
  if (user.role === 'agent') return String(record.assignedAgentId) === String(user.id);
  if (user.role === 'customer') return String(record.customerId) === String(user.id);
  return false;
}

app.get('/stats', (req, res) => {
  const user = getUserFromReq(req);
  if (!user || (user.role !== 'agent' && user.role !== 'manager')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const allRequests = router.db.get('requests').value();
  const scope = user.role === 'manager' ? allRequests : allRequests.filter(r => String(r.assignedAgentId) === String(user.id));

  const open = scope.filter(r => r.status === 'open').length;
  const inProgress = scope.filter(r => r.status === 'in_progress').length;
  const waitingForCustomer = scope.filter(r => r.status === 'waiting_for_customer').length;
  const resolved = scope.filter(r => r.status === 'resolved').length;
  const closed = scope.filter(r => r.status === 'closed').length;
  const unassigned = allRequests.filter(r => !r.assignedAgentId && r.status !== 'closed' && r.status !== 'resolved').length;
  const urgent = scope.filter(r => r.priority === 'urgent' && r.status !== 'closed' && r.status !== 'resolved').length;
  const total = scope.length;
  const active = open + inProgress + waitingForCustomer;

  const recentActivity = router.db.get('messages').value()
    .filter(m => !m.isInternal)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(m => ({
      id: m.id,
      requestId: m.requestId,
      authorName: m.authorName,
      authorRole: m.authorRole,
      contentPreview: m.content.length > 80 ? m.content.slice(0, 80) + '...' : m.content,
      createdAt: m.createdAt,
    }));

  return res.json({ open, inProgress, waitingForCustomer, resolved, closed, unassigned, urgent, total, active, recentActivity });
});

app.get('/requests', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let filtered = router.db.get('requests').value();

  if (user.role === 'agent') {
    filtered = filtered.filter(r => String(r.assignedAgentId) === String(user.id));
  } else if (user.role === 'customer') {
    filtered = filtered.filter(r => String(r.customerId) === String(user.id));
  }

  const { _page, _limit, _per_page, _sort, _order, _q, ...fieldFilters } = req.query;

  if (_q) {
    const q = String(_q).toLowerCase();
    filtered = filtered.filter(r =>
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.reference && r.reference.toLowerCase().includes(q))
    );
  }

  Object.entries(fieldFilters).forEach(([key, val]) => {
    if (!val) return;
    if (key.endsWith('_like')) {
      const field = key.replace('_like', '');
      filtered = filtered.filter(r => r[field] && String(r[field]).toLowerCase().includes(String(val).toLowerCase()));
    } else {
      filtered = filtered.filter(r => String(r[key]) === String(val));
    }
  });

  const sortField = _sort || 'updatedAt';
  const sortOrder = _order || 'desc';
  filtered = [...filtered].sort((a, b) => {
    const av = a[sortField] || '';
    const bv = b[sortField] || '';
    return sortOrder === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });

  const total = filtered.length;
  const pageSize = parseInt(_limit || _per_page || '10', 10);
  const page = parseInt(_page || '1', 10);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  res.setHeader('X-Total-Count', total);
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
  return res.json(data);
});

app.post('/requests', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role !== 'customer' && user.role !== 'agent' && user.role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, description, category, priority, customerId, assignedAgentId, status, reference, createdAt, updatedAt, resolvedAt } = req.body;
  if (!title || !description || !category || !priority) {
    return res.status(422).json({ error: 'title, description, category and priority are required' });
  }

  const now = new Date().toISOString();
  const newRequest = {
    id: uuidv4(),
    title,
    description,
    category,
    priority,
    status: status || 'open',
    reference: reference || `REQ-${Math.floor(10000 + Math.random() * 90000)}`,
    customerId: customerId || (user.role === 'customer' ? user.id : null),
    assignedAgentId: assignedAgentId || null,
    createdAt: createdAt || now,
    updatedAt: updatedAt || now,
    resolvedAt: resolvedAt || null,
  };

  router.db.get('requests').push(newRequest).write();
  return res.status(201).json(newRequest);
});

app.get('/requests/:id', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const record = router.db.get('requests').find({ id: req.params.id }).value();
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (!canAccessRequest(user, record)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json(record);
});

app.patch('/requests/:id', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const record = router.db.get('requests').find({ id: req.params.id }).value();
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (!canAccessRequest(user, record)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (user.role === 'customer') {
    return res.status(403).json({ error: 'Customers cannot update requests directly' });
  }

  const allowedFields = ['status', 'assignedAgentId', 'priority', 'updatedAt', 'resolvedAt'];
  const update = {};
  allowedFields.forEach(f => {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  });
  update.updatedAt = new Date().toISOString();

  const updated = router.db.get('requests').find({ id: req.params.id }).assign(update).write();
  return res.json(router.db.get('requests').find({ id: req.params.id }).value());
});

app.post('/requests/:id/messages', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const record = router.db.get('requests').find({ id: req.params.id }).value();
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (!canAccessRequest(user, record)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (record.status === 'closed') {
    return res.status(422).json({ error: 'Cannot send messages on a closed request' });
  }

  const { content, isInternal } = req.body;
  if (!content || !content.trim()) {
    return res.status(422).json({ error: 'Message content is required' });
  }

  if (user.role === 'customer' && isInternal) {
    return res.status(403).json({ error: 'Customers cannot create internal notes' });
  }

  const now = new Date().toISOString();
  const message = {
    id: uuidv4(),
    requestId: req.params.id,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    content: content.trim(),
    isInternal: user.role === 'customer' ? false : Boolean(isInternal),
    createdAt: now,
    attachments: [],
  };

  router.db.get('messages').push(message).write();

  router.db.get('requests').find({ id: req.params.id }).assign({
    updatedAt: now,
    status: user.role === 'customer' && record.status === 'waiting_for_customer' ? 'in_progress' : record.status,
  }).write();

  return res.status(201).json(message);
});

app.get('/messages', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let messages = router.db.get('messages').value();

  if (req.query.requestId) {
    const record = router.db.get('requests').find({ id: String(req.query.requestId) }).value();
    if (record && !canAccessRequest(user, record)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    messages = messages.filter(m => String(m.requestId) === String(req.query.requestId));
  }

  if (user.role === 'customer') {
    messages = messages.filter(m => !m.isInternal);
  }

  messages = messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json(messages);
});

app.post('/requests/:id/attachments', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const record = router.db.get('requests').find({ id: req.params.id }).value();
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (!canAccessRequest(user, record)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (record.status === 'closed') {
    return res.status(422).json({ error: 'Cannot upload attachments to a closed request' });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(422).json({ error: 'File exceeds the 10 MB size limit' });
      }
      return res.status(422).json({ error: err.message || 'Upload failed' });
    }

    if (!req.file) {
      return res.status(422).json({ error: 'No file received' });
    }

    const now = new Date().toISOString();
    const attachment = {
      id: uuidv4(),
      requestId: req.params.id,
      uploadedBy: user.id,
      uploaderName: user.name,
      uploaderRole: user.role,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      createdAt: now,
    };

    if (!router.db.has('attachments').value()) {
      router.db.set('attachments', []).write();
    }
    router.db.get('attachments').push(attachment).write();

    return res.status(201).json(attachment);
  });
});

app.get('/requests/:id/attachments', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const record = router.db.get('requests').find({ id: req.params.id }).value();
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (!canAccessRequest(user, record)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const attachments = router.db.has('attachments').value()
    ? router.db.get('attachments').filter({ requestId: req.params.id }).value()
    : [];

  return res.json(attachments);
});

app.get('/attachments/:id/download', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const attachment = router.db.has('attachments').value()
    ? router.db.get('attachments').find({ id: req.params.id }).value()
    : null;

  if (!attachment) return res.status(404).json({ error: 'Not found' });

  const record = router.db.get('requests').find({ id: attachment.requestId }).value();
  if (!canAccessRequest(user, record)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const filePath = path.join(UPLOADS_DIR, attachment.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });

  res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
  res.setHeader('Content-Type', attachment.mimeType);
  return res.sendFile(filePath);
});

app.get('/users', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let users = router.db.get('users').value();
  const { role } = req.query;
  if (role) {
    users = users.filter(u => u.role === role);
  }

  const safeUsers = users.map(({ password, ...rest }) => rest);
  return res.json(safeUsers);
});

app.use(auth.rewriter({ users: 660 }));
app.use(auth);
app.use(router);

const PORT = process.env.PORT || 3001;
app.listen(PORT);