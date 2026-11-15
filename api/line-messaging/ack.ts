import { ApiRequest, ApiResponse, readVercelStore, writeVercelStore } from '../_store.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    const store = readVercelStore();
    const { ackKeys, ackKey, source = 'app' } = req.body || {};
    const list: string[] = Array.isArray(ackKeys) ? ackKeys : ackKey ? [ackKey] : [];
    for (const k of list) {
      if (k) {
        store.ackKeys[String(k)] = { ackedAt: Date.now(), source };
      }
    }
    writeVercelStore(store);
    return res.status(200).json({ ok: true, acknowledgedKeys: Object.keys(store.ackKeys) });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || 'Ack failed' });
  }
}
