import { createServer } from 'node:http';
const handler = require('./server.js');

const server = createServer(handler);
server.listen(Number(process.env.PORT || 3000));
