const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

const server = jsonServer.create();
const middlewares = jsonServer.defaults();

const filePath = path.join(process.cwd(), 'db.json');
const rawData = fs.readFileSync(filePath, 'utf-8');
const data = JSON.parse(rawData);

const router = jsonServer.router(data);

server.use(middlewares);
server.use(router);

module.exports = server;