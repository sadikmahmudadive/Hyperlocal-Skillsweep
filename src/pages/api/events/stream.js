import { requireAuth } from '../../../middleware/auth';
import { addClient, removeClient } from '../../../lib/sse';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method not allowed');
  }

  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  const userId = String(req.userId);
  const id = addClient(userId, res);

  // initial hello event
  res.write(`event: ready\n` + `data: {"userId":"${userId}"}\n\n`);

  const ping = setInterval(() => {
    try {
      // comment line keepalive to prevent idle timeouts
      res.write(`: ping\n\n`);
    } catch (e) {
      // if writing fails, connection likely closed
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    removeClient(userId, id);
  });
}

export default requireAuth(handler);
