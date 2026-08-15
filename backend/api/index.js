const jsonServer = require("json-server");
const auth = require("json-server-auth");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = jsonServer.create();

const dbPath = path.resolve(process.cwd(), "db.json");

let router;
if (fs.existsSync(dbPath)) {
  router = jsonServer.router(dbPath);
} else {
  router = jsonServer.router(path.join(__dirname, "..", "db.json"));
}

const middlewares = jsonServer.defaults();

app.db = router.db;

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(middlewares);

app.use(
  auth.rewriter({
    users: 640,
    requests: 660,
    messages: 660,
  })
);

app.use(auth);
app.use(router);

module.exports = app;