import { ApiRequest, ApiResponse, readVercelStore, writeVercelStore } from './_store.js';

async function replyLineMessage(channelAccessToken: string, replyToken: string, text: string) {
  if (!channelAccessToken || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch {}
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'LINE Messaging API Webhook Ready' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    const store = readVercelStore();
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const token = store.lineConfig?.channelAccessToken || '';

    for (const ev of events) {
      const msgText = ev?.message?.type === 'text' ? String(ev.message.text || '').trim() : undefined;
      const src = ev?.source;
      if (src) {
        const id = String(src.groupId || src.roomId || src.userId || '');
        const type: 'user' | 'group' | 'room' = src.groupId ? 'group' : src.roomId ? 'room' : 'user';
        if (id) {
          const entry = {
            id,
            type,
            lastMessage: msgText ? msgText.slice(0, 60) : undefined,
            lastSeenAt: new Date().toISOString(),
          };
          const idx = store.capturedTargets.findIndex((t) => t.id === id);
          if (idx >= 0) store.capturedTargets[idx] = entry;
          else store.capturedTargets = [entry, ...store.capturedTargets].slice(0, 20);
        }
      }

      if (ev?.type === 'postback' && ev?.postback?.data) {
        const params = new URLSearchParams(String(ev.postback.data));
        if (params.get('action') === 'ack_alarm') {
          const ackKey = params.get('ackKey');
          const queueNumber = params.get('queueNumber') || '';
          if (ackKey) {
            store.ackKeys[ackKey] = {
              ackedAt: Date.now(),
              source: 'line',
              by: ev?.source?.userId || 'line',
            };
            if (ev.replyToken && token) {
              await replyLineMessage(
                token,
                ev.replyToken,
                `✅ ยืนยันรับทราบ${queueNumber ? ` คิว ${queueNumber}` : ''} เรียบร้อยแล้ว ระบบปิดเสียงเตือนให้ทันทีครับ`
              );
            }
          }
        }
      }

      if (ev?.type === 'message' && msgText) {
        const lower = msgText.toLowerCase();
        if (lower === 'id' || lower === 'userid') {
          const srcId = src?.groupId || src?.roomId || src?.userId || '-';
          if (ev.replyToken && token) {
            await replyLineMessage(token, ev.replyToken, `🆔 รหัส LINE ID ของแชทนี้คือ:\n${srcId}`);
          }
        } else if (
          /^(ยืนยัน|รับทราบ|ตกลง|ปิดเตือน|ok|yes|ack|1)$/i.test(msgText) ||
          msgText.includes('ยืนยันรับทราบ') ||
          msgText.includes('รับทราบ')
        ) {
          const now = Date.now();
          for (const s of store.schedules) {
            if (!store.ackKeys[s.ackKey] && now >= s.reminderAt - 10 * 60 * 1000 && now <= s.appointmentAt + 60 * 60 * 1000) {
              store.ackKeys[s.ackKey] = {
                ackedAt: now,
                source: 'line',
                by: ev?.source?.userId || 'line',
              };
            }
          }
          if (ev.replyToken && token) {
            await replyLineMessage(
              token,
              ev.replyToken,
              '✅ บันทึกยืนยันรับทราบเรียบร้อยแล้ว ระบบปิดเสียงเตือนในโปรแกรมให้แล้วครับ'
            );
          }
        }
      }
    }

    writeVercelStore(store);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
}
