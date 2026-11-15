import { ApiRequest, ApiResponse, readVercelStore } from '../_store.js';

export default async function handler(_req: ApiRequest, res: ApiResponse) {
  const store = readVercelStore();
  return res.status(200).json({
    acknowledgedKeys: Object.keys(store.ackKeys),
    ackDetails: store.ackKeys,
    capturedTargets: store.capturedTargets,
    lastSentAt: store.lastSentAt,
  });
}
