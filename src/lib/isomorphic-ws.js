// Node 22+ and modern browsers expose a native WebSocket global.
// The indexer public data provider imports { WebSocket } from 'isomorphic-ws',
// whose CJS entry (module.exports = require('ws')) defeats webpack's
// named-export detection and whose browser entry only has a default export.
// Alias this module in webpack so both bundle targets get a named WebSocket.
const WebSocket = globalThis.WebSocket;

export { WebSocket };
export default WebSocket;
