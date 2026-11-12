import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // LINE Notify Proxy Endpoint
  app.post('/api/line-notify', async (req, res) => {
    try {
      const { token, message } = req.body;

      if (!token || typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ LINE Notify Token',
        });
      }

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุข้อความที่ต้องการแจ้งเตือน',
        });
      }

      const formParams = new URLSearchParams();
      formParams.append('message', message.trim());

      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token.trim()}`,
        },
        body: formParams.toString(),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || `LINE API ตอบกลับสถานะ ${response.status}`;
        return res.status(response.status).json({
          success: false,
          message: `LINE Notify แจ้งเตือนไม่สำเร็จ: ${errorMsg}`,
          details: data,
        });
      }

      return res.json({
        success: true,
        message: 'ส่งแจ้งเตือนผ่าน LINE Notify สำเร็จเรียบร้อย!',
        data,
      });
    } catch (err: any) {
      console.error('Error in /api/line-notify:', err);
      return res.status(500).json({
        success: false,
        message: `เกิดข้อผิดพลาดในการเชื่อมต่อ LINE Notify: ${err?.message || 'Unknown error'}`,
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Repair Onsite Service LINE Notify API',
      timestamp: new Date().toISOString(),
    });
  });

  // Complete Source Code Download Endpoint (Includes full real src/ directory, public/, configs)
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
            item === '.npm'
          ) {
            continue;
          }
          const fullPath = path.join(currentDir, item);
          const relPath = path.relative(workspaceRoot, fullPath);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            addDirToZip(fullPath);
          } else {
            const fileData = fs.readFileSync(fullPath);
            zip.file(relPath, fileData);
          }
        }
      };

      // 1. Add complete src/ folder (components, services, data, types, version, styles)
      addDirToZip(path.join(workspaceRoot, 'src'));

      // 2. Add public/ folder (icons and assets)
      addDirToZip(path.join(workspaceRoot, 'public'));

      // 3. Add root configuration and code files
      const rootFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'server.ts',
        'index.html',
        'README.md',
        'metadata.json',
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
