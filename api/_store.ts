import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface ApiRequest {
  method?: string;
  body?: any;
  query?: Record<string, any>;
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
}

export interface LineAlarmStore {
  ackKeys: Record<string, { ackedAt: number; source: 'line' | 'app' | 'line_uri'; by?: string }>;
  lastSentAt: Record<string, number>;
  capturedTargets: Array<{ id: string; type: 'user' | 'group' | 'room'; lastMessage?: string; lastSeenAt: string }>;
  schedules: any[];
  lineConfig: any | null;
}

const STORE_FILE = path.join(os.tmpdir(), 'myqueue_line_alarm_store_v1.json');

export function readVercelStore(): LineAlarmStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
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

export function writeVercelStore(store: LineAlarmStore): void {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf-8');
  } catch {}
}
