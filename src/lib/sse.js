// Simple in-memory SSE broker (best-effort; not suitable for multi-instance without a shared bus)

const clientsByUser = global.__SSE_CLIENTS_BY_USER__ || new Map();
if (!global.__SSE_CLIENTS_BY_USER__) {
  global.__SSE_CLIENTS_BY_USER__ = clientsByUser;
}

export function addClient(userId, res) {
  const id = Date.now() + ':' + Math.random().toString(36).slice(2, 8);
  const entry = { id, res };
  const list = clientsByUser.get(userId) || new Set();
  list.add(entry);
  clientsByUser.set(userId, list);
  return id;
}

export function removeClient(userId, id) {
  const list = clientsByUser.get(userId);
  if (!list) return;
  for (const entry of list) {
    if (entry.id === id) {
      try { entry.res.end(); } catch (_) {}
      list.delete(entry);
      break;
    }
  }
  if (list.size === 0) clientsByUser.delete(userId);
}

export function notify(userId, event, data) {
  const list = clientsByUser.get(String(userId));
  if (!list || list.size === 0) return 0;
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  for (const { res } of list) {
    try {
      res.write(payload);
    } catch (_) {
      // ignore
    }
  }
  return list.size;
}

export function notifyUsers(userIds, event, data) {
  const seen = new Set();
  let count = 0;
  for (const uid of userIds) {
    const key = String(uid);
    if (seen.has(key)) continue;
    seen.add(key);
    count += notify(key, event, data) || 0;
  }
  return count;
}
