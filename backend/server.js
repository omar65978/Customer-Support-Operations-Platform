const jsonServer = require("json-server");
const auth = require("json-server-auth");
const cors = require("cors");
const path = require("path");

const app = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, "db.json"));

const middlewares = jsonServer.defaults({ noCors: true });

app.db = router.db;

app.use(cors({
  origin: [
    'https://support-platform-sable.vercel.app',
    'https://support-platform-5kx1.vercel.app',
    'http://localhost:5173',
    'http://localhost:4200'
  ],
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

const PORT = process.env.PORT || 3001;
app.listen(PORT);