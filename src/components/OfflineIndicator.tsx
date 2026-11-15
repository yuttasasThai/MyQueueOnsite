// File: /src/components/OfflineIndicator.tsx | Revision: Rev 18 | Version: 1.4.1
import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-400">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>โหมดออฟไลน์ — ใช้งานข้อมูลคิวงานในเครื่องได้ปกติ</span>
    </div>
  );
};
