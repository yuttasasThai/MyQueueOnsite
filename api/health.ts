import { ApiRequest, ApiResponse } from './_store.js';

export default function handler(req: ApiRequest, res: ApiResponse & { setHeader?: (k: string, v: string) => void }) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (typeof res.setHeader === 'function') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  return res.status(200).json({
    status: 'ok',
    version: '1.6.1',
    revision: 'Rev 30',
    timestamp: new Date().toISOString(),
    environment: 'vercel-serverless',
  });
}
