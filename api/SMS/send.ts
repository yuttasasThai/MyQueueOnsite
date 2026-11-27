import { ApiRequest, ApiResponse } from '../_store.js';

function normalizePhoneDigits(raw: string): string {
  const trimmed = String(raw || '').trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return hasPlus ? `+${digits}` : digits;
}

function toE164Thai(raw: string): string {
  const cleaned = normalizePhoneDigits(raw);
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    return `+66${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('66') && cleaned.length >= 10) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const {
      provider,
      toPhone,
      message,
      senderName,
      apiKey,
      apiSecret,
      webhookUrl,
    } = req.body || {};

    const cleanPhone = normalizePhoneDigits(toPhone || '');
    const msgText = String(message || '').trim();

    if (!cleanPhone || cleanPhone.replace('+', '').length < 8) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุเบอร์โทรศัพท์ผู้รับที่ถูกต้อง',
      });
    }

    if (!msgText) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อความ SMS ที่ต้องการส่ง',
      });
    }

    if (provider === 'thaibulksms') {
      const key = String(apiKey || '').trim();
      const secret = String(apiSecret || '').trim();
      if (!key || !secret) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ API Key และ API Secret ของ ThaiBulkSMS ให้ครบถ้วน',
        });
      }

      const authHeader = Buffer.from(`${key}:${secret}`).toString('base64');
      const formParams = new URLSearchParams();
      formParams.append('msisdn', cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone);
      formParams.append('message', msgText);
      if (senderName && String(senderName).trim()) {
        formParams.append('sender', String(senderName).trim());
      }
      formParams.append('force', 'standard');

      const response = await fetch('https://api-v2.thaibulksms.com/sms', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${authHeader}`,
        },
        body: formParams.toString(),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errDesc =
          data?.error?.description || data?.message || `HTTP ${response.status}`;
        return res.status(response.status).json({
          success: false,
          message: `ThaiBulkSMS ส่งไม่สำเร็จ: ${errDesc}`,
          details: data,
        });
      }

      return res.status(200).json({
        success: true,
        message: `ส่ง SMS ผ่าน ThaiBulkSMS ไปยัง ${toPhone} สำเร็จ!`,
        details: data,
      });
    }

    if (provider === 'twilio') {
      const accountSid = String(apiKey || '').trim();
      const authToken = String(apiSecret || '').trim();
      const fromNumber = String(senderName || '').trim();

      if (!accountSid || !authToken || !fromNumber) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ Account SID, Auth Token และเบอร์ผู้ส่ง (From) ของ Twilio ให้ครบถ้วน',
        });
      }

      const e164To = toE164Thai(cleanPhone);
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const formParams = new URLSearchParams();
      formParams.append('To', e164To);
      formParams.append('From', fromNumber);
      formParams.append('Body', msgText);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`,
          },
          body: formParams.toString(),
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: `Twilio ส่ง SMS ไม่สำเร็จ: ${data?.message || `HTTP ${response.status}`}`,
          details: data,
        });
      }

      return res.status(200).json({
        success: true,
        message: `ส่ง SMS ผ่าน Twilio ไปยัง ${e164To} สำเร็จ!`,
        details: data,
      });
    }

    if (provider === 'webhook') {
      const targetUrl = String(webhookUrl || '').trim();
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ Custom SMS Webhook URL ที่ขึ้นต้นด้วย http:// หรือ https://',
        });
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          e164Phone: toE164Thai(cleanPhone),
          message: msgText,
          senderName: String(senderName || '').trim(),
          timestamp: new Date().toISOString(),
        }),
      });

      const rawText = await response.text().catch(() => '');
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = { raw: rawText };
      }

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: `SMS Webhook ตอบกลับผิดพลาด (HTTP ${response.status})`,
          details: data,
        });
      }

      return res.status(200).json({
        success: true,
        message: `ส่งข้อมูลเข้า SMS Webhook เพื่อส่งถึง ${toPhone} สำเร็จ!`,
        details: data,
      });
    }

    return res.status(400).json({
      success: false,
      message: 'ไม่รู้จักผู้ให้บริการ SMS Gateway ที่เลือก',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `เกิดข้อผิดพลาดในการส่ง SMS: ${err?.message || 'Unknown error'}`,
    });
  }
}
