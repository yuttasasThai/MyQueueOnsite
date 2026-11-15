import { ApiRequest, ApiResponse } from './_store.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { token, message } = req.body || {};
    if (!token || !String(token).trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ Token' });
    }
    const formParams = new URLSearchParams();
    formParams.append('message', String(message || '').trim());

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${String(token).trim()}`,
      },
      body: formParams.toString(),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `LINE Notify ยกเลิกให้บริการแล้ว (${data?.message || response.status}) กรุณาใช้ LINE Messaging API`,
        details: data,
      });
    }

    return res.status(200).json({ success: true, message: 'ส่งแจ้งเตือนสำเร็จ!', data });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err?.message || 'Unknown error'}`,
    });
  }
}
