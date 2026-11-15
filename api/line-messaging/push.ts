import { ApiRequest, ApiResponse } from '../_store.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { channelAccessToken, targetId, sendMode, messages, message } = req.body || {};
    const token = String(channelAccessToken || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ LINE Channel Access Token' });
    }

    const resolvedMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : message
        ? [{ type: 'text', text: String(message).trim() }]
        : [];

    if (resolvedMessages.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อความที่ต้องการส่ง' });
    }

    const usePush = sendMode === 'push' && Boolean(String(targetId || '').trim());
    const endpoint = usePush
      ? 'https://api.line.me/v2/bot/message/push'
      : 'https://api.line.me/v2/bot/message/broadcast';

    const payload = usePush
      ? { to: String(targetId).trim(), messages: resolvedMessages.slice(0, 5) }
      : { messages: resolvedMessages.slice(0, 5) };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      let hint = data?.message || `LINE API ตอบกลับสถานะ ${response.status}`;
      if (response.status === 401) {
        hint = 'Channel Access Token ไม่ถูกต้องหรือหมดอายุ';
      } else if (response.status === 400 && usePush) {
        hint = `Target User/Group ID ไม่ถูกต้อง (${data?.message || 'Bad Request'})`;
      } else if (response.status === 429) {
        hint = 'โควต้าส่งข้อความ LINE OA เต็ม หรือส่งถี่เกินไป';
      }
      return res.status(response.status).json({
        success: false,
        message: `ส่ง LINE Messaging API ไม่สำเร็จ: ${hint}`,
        details: data,
      });
    }

    return res.status(200).json({
      success: true,
      message: usePush
        ? 'ส่งแจ้งเตือนเข้า LINE Messaging API (Push) สำเร็จ!'
        : 'ส่งแจ้งเตือนเข้า LINE Messaging API (Broadcast) สำเร็จ!',
      details: data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `เกิดข้อผิดพลาดใน LINE Messaging API: ${err?.message || 'Unknown error'}`,
    });
  }
}
