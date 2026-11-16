import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StoredSchedule {
  id: string;
  queueNumber: string;
  product: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  mapCoordinates?: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentAt: number;
  reminderAt: number;
  ackKey: string;
}

interface StoredLineConfig {
  enabled: boolean;
  provider?: 'messaging_api' | 'line_notify';
  channelAccessToken: string;
  targetId: string;
  sendMode: 'push' | 'broadcast';
  notifyBefore30Min: boolean;
  repeatIntervalMinutes: number;
  includeCustomerPhone?: boolean;
  includeMapLink?: boolean;
  appBaseUrl: string;
  shopName: string;
}

interface CapturedLineTarget {
  id: string;
  type: 'user' | 'group' | 'room';
  lastMessage?: string;
  lastSeenAt: string;
}

interface LineAlarmStore {
  ackKeys: Record<string, { ackedAt: number; source: 'line' | 'app' | 'line_uri'; by?: string }>;
  lastSentAt: Record<string, number>;
  capturedTargets: CapturedLineTarget[];
  schedules: StoredSchedule[];
  lineConfig: StoredLineConfig | null;
}

const STORE_FILE = path.join(os.tmpdir(), 'myqueue_line_alarm_store_v1.json');

function loadStore(): LineAlarmStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ackKeys: parsed.ackKeys || {},
        lastSentAt: parsed.lastSentAt || {},
        capturedTargets: Array.isArray(parsed.capturedTargets) ? parsed.capturedTargets : [],
        schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
        lineConfig: parsed.lineConfig || null,
      };
    }
  } catch {}
  return {
    ackKeys: {},
    lastSentAt: {},
    capturedTargets: [],
    schedules: [],
    lineConfig: null,
  };
}

const store: LineAlarmStore = loadStore();

function persistStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf-8');
  } catch {}
}

function recordCapturedTarget(source: any, lastMessage?: string) {
  if (!source) return;
  let id = '';
  let type: 'user' | 'group' | 'room' = 'user';
  if (source.groupId) {
    id = String(source.groupId);
    type = 'group';
  } else if (source.roomId) {
    id = String(source.roomId);
    type = 'room';
  } else if (source.userId) {
    id = String(source.userId);
    type = 'user';
  }
  if (!id) return;

  const existingIdx = store.capturedTargets.findIndex((t) => t.id === id);
  const entry: CapturedLineTarget = {
    id,
    type,
    lastMessage: lastMessage ? lastMessage.slice(0, 60) : undefined,
    lastSeenAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    store.capturedTargets[existingIdx] = entry;
  } else {
    store.capturedTargets = [entry, ...store.capturedTargets].slice(0, 20);
  }
}

async function dispatchLineMessagingApi(
  channelAccessToken: string,
  targetId: string,
  sendMode: 'push' | 'broadcast',
  messages: any[]
): Promise<{ success: boolean; status: number; message: string; details?: any }> {
  const token = (channelAccessToken || '').trim();
  if (!token) {
    return { success: false, status: 400, message: 'กรุณาระบุ LINE Channel Access Token' };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, status: 400, message: 'ไม่มีข้อความที่ต้องการส่ง' };
  }

  const usePush = sendMode === 'push' && Boolean(targetId?.trim());
  const endpoint = usePush
    ? 'https://api.line.me/v2/bot/message/push'
    : 'https://api.line.me/v2/bot/message/broadcast';

  const payload = usePush
    ? { to: targetId.trim(), messages: messages.slice(0, 5) }
    : { messages: messages.slice(0, 5) };

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
      hint = 'Channel Access Token ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบใน LINE Developers Console';
    } else if (response.status === 400 && usePush) {
      hint = `Target User/Group ID ไม่ถูกต้อง (${data?.message || 'Bad Request'})`;
    } else if (response.status === 429) {
      hint = 'โควต้าส่งข้อความ LINE OA รายเดือนเต็ม หรือส่งถี่เกินไป';
    }
    return {
      success: false,
      status: response.status,
      message: `ส่ง LINE Messaging API ไม่สำเร็จ: ${hint}`,
      details: data,
    };
  }

  return {
    success: true,
    status: 200,
    message: usePush
      ? 'ส่งแจ้งเตือนเข้า LINE Messaging API (Push) สำเร็จ!'
      : 'ส่งแจ้งเตือนเข้า LINE Messaging API (Broadcast) สำเร็จ!',
    details: data,
  };
}

async function replyLineMessage(channelAccessToken: string, replyToken: string, text: string) {
  if (!channelAccessToken || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
    });
  } catch (err) {
    console.warn('LINE reply error:', err);
  }
}

function buildServerReminderFlex(s: StoredSchedule, cfg: StoredLineConfig) {
  const minsLeft = Math.max(0, Math.round((s.appointmentAt - Date.now()) / 60000));
  const headerSubtitle =
    minsLeft > 0 ? `อีก ${minsLeft} นาที ถึงเวลานัด!` : 'ถึงเวลานัดหมายซ่อมแล้ว!';
  const cleanOrigin = (cfg.appBaseUrl || '').replace(/\/$/, '');
  const ackUri = cleanOrigin
    ? `${cleanOrigin}/?ack_alarm=${encodeURIComponent(s.ackKey)}&alarm_job=${encodeURIComponent(s.id)}`
    : '';
  const mapUrl =
    s.mapCoordinates && s.mapCoordinates.includes(',')
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.mapCoordinates)}`
      : s.customerAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.customerAddress)}`
      : '';

  const footerContents: any[] = [
    {
      type: 'button',
      style: 'primary',
      color: '#059669',
      height: 'sm',
      action: {
        type: 'postback',
        label: '✅ ยืนยันรับทราบ (ปิดเสียงเตือน)',
        displayText: `ยืนยันรับทราบคิว ${s.queueNumber}`,
        data: `action=ack_alarm&ackKey=${encodeURIComponent(s.ackKey)}&queueNumber=${encodeURIComponent(s.queueNumber)}`,
      },
    },
  ];
  if (ackUri) {
    footerContents.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'uri', label: '📱 เปิดแอป & ปิดเสียงเตือน', uri: ackUri },
    });
  }
  if (mapUrl) {
    footerContents.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      action: { type: 'uri', label: '📍 เปิดแผนที่นำทาง GPS', uri: mapUrl },
    });
  }

  return {
    type: 'flex',
    altText: `🚨 แจ้งเตือนก่อนนัด 30 นาที (${headerSubtitle}) คิว ${s.queueNumber}: ${s.product} (${s.appointmentTime}) — กดปุ่มหรือพิมพ์ "ยืนยัน"`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#DC2626',
        paddingAll: '14px',
        contents: [
          { type: 'text', text: '🚨 แจ้งเตือนก่อนนัด 30 นาที', color: '#FEF3C7', size: 'xs', weight: 'bold' },
          { type: 'text', text: headerSubtitle, color: '#FFFFFF', size: 'lg', weight: 'bold', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: `คิว ${s.queueNumber} • ${s.product}`,
            weight: 'bold',
            size: 'md',
            wrap: true,
            color: '#0F172A',
          },
          {
            type: 'text',
            text: `⏰ เวลานัด: ${s.appointmentDate} (${s.appointmentTime})`,
            size: 'sm',
            weight: 'bold',
            color: '#DC2626',
            wrap: true,
            margin: 'sm',
          },
          {
            type: 'text',
            text: `👤 ลูกค้า: ${s.customerName} (${s.customerPhone})`,
            size: 'xs',
            color: '#334155',
            wrap: true,
            margin: 'xs',
          },
          {
            type: 'text',
            text: 'ระบบจะเตือนซ้ำจนกว่าจะกดยืนยันรับทราบ หรือพิมพ์ "ยืนยัน" / "รับทราบ"',
            size: 'xxs',
            color: '#B45309',
            wrap: true,
            margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        contents: footerContents,
      },
    },
  };
}

async function runBackgroundReminderTick() {
  const cfg = store.lineConfig;
  if (!cfg || !cfg.enabled || !cfg.notifyBefore30Min || !cfg.channelAccessToken) return;
  if (cfg.provider === 'line_notify') return;

  const now = Date.now();
  const repeatMs = Math.max(1, Number(cfg.repeatIntervalMinutes) || 2) * 60 * 1000;
  let dirty = false;

  for (const s of store.schedules) {
    if (store.ackKeys[s.ackKey]) continue;
    if (now >= s.reminderAt && now <= s.appointmentAt + 30 * 60 * 1000) {
      const last = store.lastSentAt[s.ackKey] || 0;
      if (now - last >= repeatMs) {
        store.lastSentAt[s.ackKey] = now;
        dirty = true;
        const flexMsg = buildServerReminderFlex(s, cfg);
        dispatchLineMessagingApi(cfg.channelAccessToken, cfg.targetId, cfg.sendMode, [flexMsg]).catch(
          (err) => console.warn('[bg-line-alarm] dispatch error:', err)
        );
      }
    }
  }

  if (dirty) persistStore();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Background 20-second loop for 30-min LINE Messaging API repeat reminders
  setInterval(() => {
    runBackgroundReminderTick();
  }, 20 * 1000);

  // LINE Messaging API: Push / Broadcast endpoint
  app.post('/api/line-messaging/push', async (req, res) => {
    try {
      const { channelAccessToken, targetId, sendMode, messages, message } = req.body || {};
      const resolvedMessages =
        Array.isArray(messages) && messages.length > 0
          ? messages
          : message
          ? [{ type: 'text', text: String(message).trim() }]
          : [];
      const result = await dispatchLineMessagingApi(
        channelAccessToken,
        targetId,
        sendMode === 'push' ? 'push' : 'broadcast',
        resolvedMessages
      );
      return res.status(result.status).json(result);
    } catch (err: any) {
      console.error('Error in /api/line-messaging/push:', err);
      return res.status(500).json({
        success: false,
        message: `เกิดข้อผิดพลาดใน LINE Messaging API: ${err?.message || 'Unknown error'}`,
      });
    }
  });

  // Sync schedules + LINE Messaging API config from client so server repeats alerts even when browser is closed
  app.post('/api/line-messaging/sync-schedules', (req, res) => {
    try {
      const { schedules, lineConfig, acknowledgedKeys } = req.body || {};
      if (Array.isArray(schedules)) {
        store.schedules = schedules;
      }
      if (lineConfig && typeof lineConfig === 'object') {
        store.lineConfig = lineConfig;
      }
      if (Array.isArray(acknowledgedKeys)) {
        for (const k of acknowledgedKeys) {
          if (k && !store.ackKeys[k]) {
            store.ackKeys[k] = { ackedAt: Date.now(), source: 'app' };
          }
        }
      }
      persistStore();
      return res.json({
        ok: true,
        acknowledgedKeys: Object.keys(store.ackKeys),
        capturedTargets: store.capturedTargets,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, message: err?.message || 'Sync failed' });
    }
  });

  // Mark alarm acknowledged from App or LINE URI button
  app.post('/api/line-messaging/ack', (req, res) => {
    try {
      const { ackKeys, ackKey, source = 'app' } = req.body || {};
      const list: string[] = Array.isArray(ackKeys) ? ackKeys : ackKey ? [ackKey] : [];
      for (const k of list) {
        if (k) {
          store.ackKeys[String(k)] = { ackedAt: Date.now(), source };
        }
      }
      persistStore();
      return res.json({ ok: true, acknowledgedKeys: Object.keys(store.ackKeys) });
    } catch (err: any) {
      return res.status(500).json({ ok: false, message: err?.message || 'Ack failed' });
    }
  });

  // Poll acknowledged keys + captured LINE User/Group IDs
  app.get('/api/line-messaging/status', (_req, res) => {
    return res.json({
      acknowledgedKeys: Object.keys(store.ackKeys),
      ackDetails: store.ackKeys,
      capturedTargets: store.capturedTargets,
      lastSentAt: store.lastSentAt,
    });
  });

  // LINE Messaging API Webhook (Verification + Postback "ยืนยันรับทราบ" + Text "ยืนยัน/รับทราบ" + Auto-capture IDs)
  app.get('/api/line-webhook', (_req, res) => {
    res.json({ status: 'ok', message: 'LINE Messaging API Webhook Endpoint Ready' });
  });

  app.post('/api/line-webhook', async (req, res) => {
    // Always respond 200 OK quickly for LINE Webhook Verification
    res.status(200).json({ ok: true });

    try {
      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      const token = store.lineConfig?.channelAccessToken || '';
      let dirty = false;

      for (const ev of events) {
        const msgText = ev?.message?.type === 'text' ? String(ev.message.text || '').trim() : undefined;
        recordCapturedTarget(ev?.source, msgText);
        dirty = true;

        // 1) Interactive Postback button click ("✅ ยืนยันรับทราบ")
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
              dirty = true;
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

        // 2) Text message reply ("ยืนยัน", "รับทราบ", "ok", "1", "id")
        if (ev?.type === 'message' && msgText) {
          const lower = msgText.toLowerCase();
          if (lower === 'id' || lower === 'userid') {
            const srcId = ev?.source?.groupId || ev?.source?.roomId || ev?.source?.userId || '-';
            if (ev.replyToken && token) {
              await replyLineMessage(token, ev.replyToken, `🆔 รหัส LINE ID ของแชทนี้คือ:\n${srcId}`);
            }
          } else if (
            /^(ยืนยัน|รับทราบ|ตกลง|ปิดเตือน|ok|yes|ack|1)$/i.test(msgText) ||
            msgText.includes('ยืนยันรับทราบ') ||
            msgText.includes('รับทราบ')
          ) {
            const now = Date.now();
            const ackedQueues: string[] = [];
            for (const s of store.schedules) {
              if (!store.ackKeys[s.ackKey] && now >= s.reminderAt - 10 * 60 * 1000 && now <= s.appointmentAt + 60 * 60 * 1000) {
                store.ackKeys[s.ackKey] = {
                  ackedAt: now,
                  source: 'line',
                  by: ev?.source?.userId || 'line',
                };
                ackedQueues.push(s.queueNumber);
              }
            }
            // If no matching schedule in window, still mark any recent lastSentAt ackKey
            if (ackedQueues.length === 0) {
              for (const k of Object.keys(store.lastSentAt)) {
                if (!store.ackKeys[k] && now - store.lastSentAt[k] <= 2 * 60 * 60 * 1000) {
                  store.ackKeys[k] = { ackedAt: now, source: 'line', by: ev?.source?.userId || 'line' };
                }
              }
            }
            dirty = true;
            if (ev.replyToken && token) {
              const qLabel = ackedQueues.length > 0 ? ` (${ackedQueues.join(', ')})` : '';
              await replyLineMessage(
                token,
                ev.replyToken,
                `✅ บันทึกยืนยันรับทราบ${qLabel} เรียบร้อยแล้ว ระบบปิดเสียงเตือนในโปรแกรมให้แล้วครับ`
              );
            }
          }
        }
      }

      if (dirty) persistStore();
    } catch (err) {
      console.error('Error processing LINE webhook:', err);
    }
  });

  // Legacy LINE Notify Proxy Endpoint (deprecated by LINE, kept for backwards compatibility)
  app.post('/api/line-notify', async (req, res) => {
    try {
      const { token, message } = req.body;
      if (!token || typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ Token' });
      }
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุข้อความที่ต้องการแจ้งเตือน' });
      }

      const formParams = new URLSearchParams();
      formParams.append('message', message.trim());

      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token.trim()}`,
        },
        body: formParams.toString(),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: `LINE Notify ยกเลิกให้บริการแล้วหรือ Token ใช้ไม่ได้ (${data?.message || response.status}) แนะนำเปลี่ยนเป็น LINE Messaging API`,
          details: data,
        });
      }

      return res.json({ success: true, message: 'ส่งแจ้งเตือนสำเร็จ!', data });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err?.message || 'Unknown error'}`,
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MyQueue Onsite Service LINE Messaging API',
      timestamp: new Date().toISOString(),
    });
  });

  // Complete Source Code Download Endpoint
  app.get('/api/download-source-zip', async (_req, res) => {
    try {
      const zip = new JSZip();
      const workspaceRoot = __dirname;

      const addDirToZip = (currentDir: string) => {
        if (!fs.existsSync(currentDir)) return;
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
          if (
            item === 'node_modules' ||
            item === 'dist' ||
            item === '.git' ||
            item === '.cache' ||
            item === '.npm' ||
            item === 'aistudio'
          ) {
            continue;
          }
          const fullPath = path.join(currentDir, item);
          const relPath = path.relative(workspaceRoot, fullPath);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            addDirToZip(fullPath);
          } else {
            zip.file(relPath, fs.readFileSync(fullPath));
          }
        }
      };

      addDirToZip(path.join(workspaceRoot, 'src'));
      addDirToZip(path.join(workspaceRoot, 'public'));
      addDirToZip(path.join(workspaceRoot, 'api'));

      const rootFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'server.ts',
        'index.html',
        'README.md',
        'metadata.json',
        '.npmrc',
        '.gitignore',
        'vercel.json',
      ];

      for (const rf of rootFiles) {
        const fp = path.join(workspaceRoot, rf);
        if (fs.existsSync(fp)) {
          zip.file(rf, fs.readFileSync(fp));
        }
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="onsite-repair-service-source-code.zip"'
      );
      res.setHeader('Content-Length', zipBuffer.length);
      return res.end(zipBuffer);
    } catch (err: any) {
      console.error('Failed to generate source zip:', err);
      return res.status(500).json({
        success: false,
        message: `ไม่สามารถบีบอัดไฟล์ Source Code ได้: ${err?.message || 'Unknown error'}`,
      });
    }
  });

  // In production serve dist build; in development use Vite middlewares
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    fs.existsSync(path.resolve(__dirname, 'dist'));

  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
