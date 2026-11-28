// File: /src/components/Dashboard.tsx | Revision: Rev 30 | Version: 1.6.1 | Modified: 2026-11-27
import React from 'react';
import { RepairJob, ShopSettings, UserAccount } from '../types';
import { HeroCover } from './HeroCover';

interface DashboardProps {
  jobs: RepairJob[];
  users?: UserAccount[];
  settings?: ShopSettings;
  onNavigateToQueue: (statusFilter?: string) => void;
  onSelectJob?: (job: RepairJob) => void;
  onOpenNewJob: () => void;
  onOpenExpiredWarrantyModal?: () => void;
  onClearAllJobs?: () => void;
  isAdmin?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  jobs,
  settings,
  onNavigateToQueue,
  onOpenNewJob,
  onClearAllJobs,
  isAdmin = false,
}) => {
  return (
    <div className="w-full flex items-center justify-center py-2 sm:py-4">
      <HeroCover
        jobs={jobs}
        settings={settings}
        onOpenNewJob={onOpenNewJob}
        onNavigateToQueue={(status) => onNavigateToQueue(status)}
        onClearAllJobs={onClearAllJobs}
        isAdmin={isAdmin}
      />
    </div>
  );
};
