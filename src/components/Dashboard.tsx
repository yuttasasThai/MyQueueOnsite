// File: /src/components/Dashboard.tsx | Revision: Rev 6 | Version: 1.2.1 | Modified: 2026-11-11
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
}

export const Dashboard: React.FC<DashboardProps> = ({
  jobs,
  settings,
  onNavigateToQueue,
  onOpenNewJob,
  onClearAllJobs,
}) => {
  return (
    <div className="w-full flex items-center justify-center py-2 sm:py-4">
      <HeroCover
        jobs={jobs}
        settings={settings}
        onOpenNewJob={onOpenNewJob}
        onNavigateToQueue={() => onNavigateToQueue()}
        onClearAllJobs={onClearAllJobs}
      />
    </div>
  );
};
