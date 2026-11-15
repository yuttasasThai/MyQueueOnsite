import { ApiRequest, ApiResponse, readVercelStore, writeVercelStore } from '../_store.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    const store = readVercelStore();
    const { schedules, lineConfig, acknowledgedKeys } = req.body || {};
    if (Array.isArray(schedules)) store.schedules = schedules;
    if (lineConfig && typeof lineConfig === 'object') store.lineConfig = lineConfig;
    if (Array.isArray(acknowledgedKeys)) {
      for (const k of acknowledgedKeys) {
        if (k && !store.ackKeys[k]) {
          store.ackKeys[k] = { ackedAt: Date.now(), source: 'app' };
        }
      }
    }
    writeVercelStore(store);
    return res.status(200).json({
      ok: true,
      acknowledgedKeys: Object.keys(store.ackKeys),
      capturedTargets: store.capturedTargets,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || 'Sync failed' });
  }
}
