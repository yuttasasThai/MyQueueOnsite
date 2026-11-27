import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCode,
  Download,
  CheckCircle2,
  FolderArchive,
  FolderCheck,
  Database,
  RefreshCw,
  Search,
  Copy,
  Check,
  Eye,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Zap,
  FileText,
  Lock,
  Loader2,
  AlertTriangle,
  Fingerprint,
  Server,
} from 'lucide-react';
import { RepairJob, ShopSettings, UserAccount } from '../types';
import { APP_VERSION, APP_REVISION, REVISION_HISTORY } from '../version';
import { buildAdminLink } from '../services/storage';
import {
  getBundledSourceFiles,
  verifyPackageSnapshot,
  runPreDownloadVerification,
  buildClientSourceZip,
  triggerFileDownload,
  forceRefreshLatestVersion,
  BundledSourceFile,
  BuildZipResult,
  PreDownloadCheckReport,
  ZipBuildStage,
} from '../services/sourcePackager';

interface SourceCodeDownloadPageProps {
  isAdmin: boolean;
  settings: ShopSettings;
  jobs: RepairJob[];
  users: UserAccount[];
}

export const SourceCodeDownloadPage: React.FC<SourceCodeDownloadPageProps> = ({
  isAdmin,
  settings,
  jobs,
  users,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'src' | 'api' | 'public' | 'config'>('all');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('package.json');
  const [isBuildingMode, setIsBuildingMode] = useState<'full' | 'lite' | null>(null);
  const [buildStage, setBuildStage] = useState<ZipBuildStage>('verify');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [lastResult, setLastResult] = useState<BuildZipResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [checkReport, setCheckReport] = useState<PreDownloadCheckReport | null>(null);

  const verification = useMemo(() => verifyPackageSnapshot(), []);
  const allFiles = useMemo(() => getBundledSourceFiles(), []);
  const adminLink = buildAdminLink(settings.adminSecretToken);
  const latestRevision = REVISION_HISTORY[0];

  const handleRunVerification = async (): Promise<PreDownloadCheckReport> => {
    setIsVerifying(true);
    const report = await runPreDownloadVerification();
    setCheckReport(report);
    setIsVerifying(false);
    return report;
  };

  useEffect(() => {
    if (!isAdmin) return;
    handleRunVerification();
  }, [isAdmin]);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allFiles.filter((file) => {
      const matchCat = categoryFilter === 'all' || file.category === categoryFilter;
      const matchSearch = !q || file.path.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allFiles, categoryFilter, searchQuery]);

  const selectedFile: BundledSourceFile | undefined = useMemo(
    () => allFiles.find((f) => f.path === selectedFilePath) || allFiles[0],
    [allFiles, selectedFilePath]
  );

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-md mx-auto my-8 space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="font-bold text-slate-900 text-base">สิทธิ์การเข้าถึงถูกจำกัด</h2>
        <p className="text-xs text-slate-600">
          หน้าดาวน์โหลด Source Code สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
        </p>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleBuildAndDownload = async (includeMediaAssets: boolean, bypassStaleGuard = false) => {
    try {
      setErrorMsg('');
      setLastResult(null);
      setIsBuildingMode(includeMediaAssets ? 'full' : 'lite');
      setBuildStage('verify');
      setProgressPercent(4);
      setProgressLabel('ขั้นตอน 1/4: กำลังตรวจสอบความสดใหม่ของข้อมูลและเวอร์ชันล่าสุด...');

      const report = await handleRunVerification();
      if (!report.requiredFilesPresent) {
        setIsBuildingMode(null);
        setErrorMsg(
          `พบไฟล์สำคัญไม่ครบ (${report.missingRequiredFiles.join(', ')}) กรุณากดล้างแคชเพื่อโหลดเวอร์ชันล่าสุด`
        );
        return;
      }

      if (report.serverCheckStatus === 'stale' && !bypassStaleGuard) {
        setIsBuildingMode(null);
        setErrorMsg(
          `ตรวจพบเวอร์ชันใหม่กว่าบนเซิร์ฟเวอร์ (v${report.serverVersion}) ขณะที่เบราว์เซอร์ยังถือแคช v${report.appVersion} กรุณากด "ล้างแคช & เช็กเวอร์ชันล่าสุด" ด้านบนก่อนดาวน์โหลด`
        );
        return;
      }

      setProgressPercent(10);
      setProgressLabel('ขั้นตอน 2/4: ยืนยันข้อมูลล่าสุดเรียบร้อย กำลังรวบรวมไฟล์โค้ด...');

      const res = await buildClientSourceZip({
        includeMediaAssets,
        onProgress: (pct, label, stage) => {
          setProgressPercent(pct);
          setProgressLabel(label);
          setBuildStage(stage);
        },
      });

      triggerFileDownload(res.blob, res.filename);
      setLastResult(res);
      setBuildStage('done');
      setIsBuildingMode(null);
    } catch (err: any) {
      setIsBuildingMode(null);
      setErrorMsg(
        `ไม่สามารถสร้างไฟล์ ZIP ได้: ${err?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}`
      );
    }
  };

  const handleDownloadSingleFile = (file: BundledSourceFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const baseName = file.path.split('/').pop() || 'file.txt';
    triggerFileDownload(blob, baseName);
  };

  const handleDownloadDatabaseJson = () => {
    const data = {
      exportDate: new Date().toISOString(),
      version: APP_VERSION,
      revision: APP_REVISION,
      shopSettings: settings,
      repairJobs: jobs,
      userAccounts: users,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    triggerFileDownload(
      blob,
      `onsite-repair-database-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
  };

  const handleForceRefresh = async () => {
    setIsRefreshingCache(true);
    await forceRefreshLatestVersion();
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-lg border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>In-Browser ZIP Builder (ไม่ต้องพึ่ง Server)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-mono font-bold">
                v{APP_VERSION} ({APP_REVISION})
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              ศูนย์ดาวน์โหลด Source Code ล่าสุด
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              แพ็กเกจโค้ดทั้งหมดถูกสร้างขึ้นจากไฟล์จริงในบิลด์ปัจจุบันโดยตรงบนเบราว์เซอร์ 100%
              หมดปัญหาการเชื่อมต่อล้มเหลว (Failed to fetch) และสามารถตรวจสอบเนื้อหาทุกไฟล์ก่อนอัปโหลดขึ้น GitHub ได้ทันที
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleForceRefresh}
              disabled={isRefreshingCache}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              title="ล้างแคชเก่าของเบราว์เซอร์แล้วโหลดหน้าเว็บใหม่"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingCache ? 'animate-spin' : ''}`} />
              <span>{isRefreshingCache ? 'กำลังล้างแคช...' : 'ล้างแคช & เช็กเวอร์ชันล่าสุด'}</span>
            </button>
          </div>
        </div>

        {/* Version Verification Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">เวอร์ชันใน package.json</div>
            <div className="font-mono font-bold text-sm text-emerald-300 mt-0.5 flex items-center gap-1.5">
              <span>v{verification.packageJsonVersion}</span>
              {verification.isVersionSynced && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">ไฟล์ในโฟลเดอร์ src/</div>
            <div className="font-mono font-bold text-sm text-white mt-0.5 tabular-nums">
              {verification.srcFilesCount} ไฟล์
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">API + ไฟล์ตั้งค่าราก</div>
            <div className="font-mono font-bold text-sm text-white mt-0.5 tabular-nums">
              {verification.apiFilesCount + verification.configFilesCount} ไฟล์
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">ขนาดโค้ดรวม (ไม่รวมรูป)</div>
            <div className="font-mono font-bold text-sm text-blue-200 mt-0.5 tabular-nums">
              {formatBytes(verification.totalCodeBytes)}
            </div>
          </div>
        </div>

        {latestRevision && (
          <div className="bg-blue-950/60 border border-blue-800/70 rounded-xl px-3.5 py-2.5 text-xs text-blue-100 leading-relaxed">
            <strong className="text-white">การอัปเดตล่าสุด ({latestRevision.version} · {latestRevision.date}):</strong>{' '}
            {latestRevision.description}
          </div>
        )}
      </div>

      {/* Pre-Download Freshness & Data Integrity Verification Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isVerifying
                  ? 'bg-blue-50 text-blue-600'
                  : checkReport?.allPassed
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {isVerifying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : checkReport?.allPassed ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                <span>ตรวจสอบข้อมูลก่อนดาวน์โหลด (Pre-Download Verification)</span>
                {!isVerifying && checkReport && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      checkReport.allPassed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {checkReport.allPassed
                      ? 'ข้อมูลเป็นปัจจุบันที่สุด พร้อมดาวน์โหลด'
                      : checkReport.serverCheckStatus === 'stale'
                      ? 'พบเวอร์ชันใหม่กว่าบนเซิร์ฟเวอร์'
                      : 'กรุณาตรวจสอบรายการด้านล่าง'}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isVerifying
                  ? 'กำลังตรวจเช็กความตรงกันของไฟล์และเวอร์ชันล่าสุด...'
                  : checkReport
                  ? `ตรวจสอบล่าสุดเมื่อ ${new Date(checkReport.checkedAt).toLocaleTimeString('th-TH')} · ครบ ${checkReport.totalFilesChecked} ไฟล์`
                  : 'กดตรวจสอบเพื่อยืนยันข้อมูลล่าสุด'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isVerifying || isBuildingMode !== null}
            onClick={handleRunVerification}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>ตรวจสอบข้อมูลอีกครั้ง</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* Check 1: Version Sync */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>1. เวอร์ชันแพ็กเกจ</span>
              {checkReport?.versionSynced ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              )}
            </div>
            <div className="font-mono font-bold text-slate-900">
              v{checkReport?.packageJsonVersion || verification.packageJsonVersion} ({APP_REVISION})
            </div>
            <div className="text-[10px] text-emerald-700 font-medium">
              {checkReport?.versionSynced
                ? 'ตรงกับ src/version.ts 100%'
                : 'กำลังตรวจสอบความสอดคล้อง...'}
            </div>
          </div>

          {/* Check 2: Server Freshness */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3" />
                <span>2. เทียบเซิร์ฟเวอร์ล่าสุด</span>
              </span>
              {checkReport?.serverCheckStatus === 'matched' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              {checkReport?.serverCheckStatus === 'stale' && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
            </div>
            <div className="font-mono font-bold text-slate-900">
              {isVerifying
                ? 'กำลังเชื่อมต่อ...'
                : checkReport?.serverCheckStatus === 'matched'
                ? `v${checkReport.serverVersion || APP_VERSION} (ล่าสุด)`
                : checkReport?.serverCheckStatus === 'stale'
                ? `พบ v${checkReport.serverVersion}`
                : `Snapshot v${APP_VERSION}`}
            </div>
            <div
              className={`text-[10px] font-medium ${
                checkReport?.serverCheckStatus === 'stale'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {checkReport?.serverCheckStatus === 'matched'
                ? 'ตรงกับโค้ดบนเซิร์ฟเวอร์ล่าสุด'
                : checkReport?.serverCheckStatus === 'stale'
                ? 'กรุณากดล้างแคชด้านบนเพื่ออัปเดต'
                : 'พร้อมใช้งานแบบ Static / Offline'}
            </div>
          </div>

          {/* Check 3: Required Files Completeness */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>3. ความครบถ้วนของไฟล์</span>
              {checkReport?.requiredFilesPresent ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              )}
            </div>
            <div className="font-mono font-bold text-slate-900 tabular-nums">
              {checkReport?.totalFilesChecked ?? verification.totalCodeFiles} ไฟล์หลัก
            </div>
            <div className="text-[10px] text-emerald-700 font-medium">
              {checkReport?.requiredFilesPresent
                ? 'src, api, config ครบไม่พบไฟล์เสีย'
                : 'กำลังสแกนโครงสร้างไฟล์...'}
            </div>
          </div>

          {/* Check 4: SHA-256 Checksum */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Fingerprint className="w-3 h-3" />
                <span>4. ลายนิ้วมือโค้ด (SHA-256)</span>
              </span>
              {checkReport?.codeChecksumSha256 && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </div>
            <div className="font-mono font-bold text-slate-900 truncate">
              {checkReport?.codeChecksumSha256
                ? checkReport.codeChecksumSha256.slice(0, 14)
                : 'กำลังคำนวณ...'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              {checkReport ? formatBytes(checkReport.totalCodeBytes) : '...'}
            </div>
          </div>
        </div>

        {checkReport?.serverCheckStatus === 'stale' && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
            <span>
              เซิร์ฟเวอร์มีโค้ดใหม่กว่า (<strong>v{checkReport.serverVersion}</strong>) แต่เบราว์เซอร์ยังถือแคช{' '}
              <strong>v{checkReport.appVersion}</strong> อยู่
            </span>
            <button
              type="button"
              onClick={handleForceRefresh}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 cursor-pointer"
            >
              อัปเดตหน้าเว็บเป็น v{checkReport.serverVersion} ทันที
            </button>
          </div>
        )}
      </div>

      {/* Primary Download Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option 1: Full ZIP in Browser */}
        <div className="bg-white rounded-2xl border-2 border-blue-600 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                <FolderCheck className="w-3.5 h-3.5" />
                <span>แนะนำ · ครบทุกไฟล์ 100%</span>
              </div>
              <span className="font-mono text-xs text-slate-500 font-semibold">
                v{APP_VERSION}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FolderArchive className="w-5 h-5 text-blue-600 shrink-0" />
              <span>ดาวน์โหลด Full Source Code (.zip)</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              สร้างไฟล์ <code className="bg-slate-100 px-1 rounded">.zip</code> ในเบราว์เซอร์ของคุณโดยตรง
              รวมโค้ด <code className="bg-slate-100 px-1 rounded">src/</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">api/</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">public/</code>, ไฟล์คอนฟิก และรูปภาพทั้งหมด
              พร้อมตรวจสอบความถูกต้องก่อนดาวน์โหลด
            </p>
          </div>

          <button
            type="button"
            disabled={isBuildingMode !== null}
            onClick={() => handleBuildAndDownload(true)}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            {isBuildingMode === 'full' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isBuildingMode === 'full'
                ? `กำลังตรวจสอบและสร้าง ZIP (${progressPercent}%)...`
                : `ตรวจสอบและดาวน์โหลด Full ZIP (v${APP_VERSION})`}
            </span>
          </button>
        </div>

        {/* Option 2: Lightweight Code-Only ZIP */}
        <div className="bg-white rounded-2xl border border-emerald-300 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                <Zap className="w-3.5 h-3.5" />
                <span>โหลดเร็วสุด · ไม่ใช้เน็ตแม้แต่ KB เดียว</span>
              </div>
              <span className="font-mono text-xs text-slate-500 font-semibold">
                ~220 KB
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>ดาวน์โหลดเฉพาะโค้ดล่าสุด (Code Lite .zip)</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              รวมไฟล์โค้ดทั้งหมด {verification.totalCodeFiles} ไฟล์ (<code className="bg-slate-100 px-1 rounded">src/</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">api/</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">server.ts</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">package.json</code> ฯลฯ) โดยข้ามรูปขนาดใหญ่
              เหมาะสำหรับอัปเดตโค้ดทับใน GitHub Repo เดิมได้ในเสี้ยววินาที
            </p>
          </div>

          <button
            type="button"
            disabled={isBuildingMode !== null}
            onClick={() => handleBuildAndDownload(false)}
            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            {isBuildingMode === 'lite' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isBuildingMode === 'lite'
                ? `กำลังสร้าง Code Lite ZIP (${progressPercent}%)...`
                : `ตรวจสอบและดาวน์โหลด Code Lite ZIP (v${APP_VERSION})`}
            </span>
          </button>
        </div>
      </div>

      {/* Multi-Stage Progress Indicator Card */}
      {isBuildingMode !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-blue-950">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span>{progressLabel}</span>
            </span>
            <span className="font-mono text-sm text-blue-700 tabular-nums shrink-0">
              {progressPercent}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-blue-200/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-200 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 4-Step Visual Progress Tracker */}
          {(() => {
            const stageOrder: ZipBuildStage[] = [
              'verify',
              'collect_code',
              'collect_media',
              'compress',
              'validate_zip',
              'done',
            ];
            const currentIdx = stageOrder.indexOf(buildStage);
            const steps = [
              { label: '1. ตรวจเวอร์ชันล่าสุด', minIdx: 0, doneIdx: 1 },
              { label: '2. รวบรวมไฟล์โค้ด', minIdx: 1, doneIdx: 2 },
              { label: '3. บีบอัดไฟล์ .zip', minIdx: 2, doneIdx: 4 },
              { label: '4. ยืนยัน PK & SHA-256', minIdx: 4, doneIdx: 5 },
            ];
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                {steps.map((step) => {
                  const isCompleted = currentIdx >= step.doneIdx;
                  const isActive = !isCompleted && currentIdx >= step.minIdx;
                  return (
                    <div
                      key={step.label}
                      className={`px-2.5 py-2 rounded-xl border flex items-center gap-1.5 font-semibold transition-colors ${
                        isCompleted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : isActive
                          ? 'bg-white border-blue-300 text-blue-800 shadow-2xs'
                          : 'bg-white/50 border-blue-100 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                      )}
                      <span className="truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {lastResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm text-emerald-900">
                ยืนยันข้อมูลล่าสุดและสร้าง {lastResult.filename} สำเร็จ 100%
              </div>
              <div className="text-emerald-800 font-mono">
                ขนาดไฟล์ {formatBytes(lastResult.zipSizeBytes)} • โค้ด {lastResult.includedCodeFiles} ไฟล์ • รูปภาพ {lastResult.includedMediaFiles} ไฟล์ • PK Header Valid
              </div>
              <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 shrink-0" />
                <span>ZIP SHA-256: {lastResult.zipSha256.slice(0, 20)}...</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => triggerFileDownload(lastResult.blob, lastResult.filename)}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shrink-0 cursor-pointer shadow-xs"
          >
            กดบันทึกซ้ำ
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-800 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>{errorMsg}</span>
          {checkReport?.serverCheckStatus === 'stale' && (
            <button
              type="button"
              onClick={() => handleBuildAndDownload(true, true)}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold shrink-0 cursor-pointer"
            >
              ยืนยันโหลดเวอร์ชันปัจจุบันต่อไป
            </button>
          )}
        </div>
      )}

      {/* Secondary Tools: Server Direct Link, JSON Backup & Admin Link */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/download-source-zip?dl=1"
            download={`onsite-repair-service-v${APP_VERSION}-source-code.zip`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>ลิงก์ตรงจาก Server (/api/download-source-zip)</span>
          </a>

          <button
            type="button"
            onClick={handleDownloadDatabaseJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>สำรองฐานข้อมูลคิวงาน ({jobs.length} งาน · .json)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">Admin Link:</span>
          <input
            type="text"
            readOnly
            value={adminLink}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-slate-700 w-full lg:w-64 truncate"
          />
          <button
            type="button"
            onClick={() => handleCopy(adminLink, 'adminLink')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold shrink-0 flex items-center gap-1 cursor-pointer"
          >
            {copiedKey === 'adminLink' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copiedKey === 'adminLink' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
          </button>
        </div>
      </div>

      {/* Live Source Code & Version Verification Explorer */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>ตรวจสอบไฟล์ทั้งหมดที่จะรวมอยู่ใน ZIP (ยืนยันว่าเป็นไฟล์ v{APP_VERSION} ล่าสุด)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              คลิกที่ชื่อไฟล์เพื่อเปิดดูโค้ดล่าสุดด้านในจริงก่อนดาวน์โหลด
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อไฟล์..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold">
              {(['all', 'src', 'api', 'public', 'config'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'all' ? `ทั้งหมด (${allFiles.length})` : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* File Tree List */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="font-mono truncate">{file.path}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0 tabular-nums">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected File Code Preview */}
          <div className="lg:col-span-7 flex flex-col bg-slate-950 text-slate-100">
            {selectedFile && (
              <>
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-blue-300 truncate">
                    {selectedFile.path}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedFile.content, 'previewCode')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'previewCode' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'previewCode' ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleFile(selectedFile)}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>โหลดไฟล์นี้</span>
                    </button>
                  </div>
                </div>
                <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-auto max-h-[340px] text-slate-200 whitespace-pre">
                  {selectedFile.content}
                </pre>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GitHub + Vercel Deploy Instructions */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 sm:p-5 text-xs text-blue-950 space-y-2.5">
        <div className="font-bold text-blue-900 flex items-center gap-1.5 text-sm">
          <Terminal className="w-4 h-4 text-blue-600 shrink-0" />
          <span>ขั้นตอนอัปโหลดขึ้น GitHub ให้ Vercel อัปเดตเป็น v{APP_VERSION} อย่างถูกต้อง (แก้ปัญหาลิงก์ยังค้าง v1.5.1):</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-blue-900/90 leading-relaxed">
          <li>
            กดปุ่ม <strong>ดาวน์โหลด Full ZIP (v{APP_VERSION})</strong> ด้านบน แล้วแตกไฟล์ <code className="bg-white px-1 rounded">.zip</code> ออกมา
          </li>
          <li>
            เปิดเข้าไป <strong>ข้างในโฟลเดอร์ที่แตกออกมา</strong> แล้วนำไฟล์และโฟลเดอร์ทั้งหมดข้างใน (
            <code className="bg-white px-1 rounded">src/</code>, <code className="bg-white px-1 rounded">api/</code>,{' '}
            <code className="bg-white px-1 rounded">public/</code>, <code className="bg-white px-1 rounded">package.json</code>,{' '}
            <code className="bg-white px-1 rounded">vercel.json</code>, <code className="bg-white px-1 rounded">firebase-applet-config.json</code>,{' '}
            <code className="bg-white px-1 rounded">.npmrc</code>) วางทับที่หน้าแรกสุด (<strong>Root</strong>) ของ GitHub Repo — <strong>ห้าม</strong>วางทั้งโฟลเดอร์ซ้อนลงไป
          </li>
          <li>
            ตรวจสอบในหน้าเว็บ <strong>Vercel Dashboard → Deployments</strong> ว่าบิลด์ล่าสุดขึ้นสถานะ <strong className="text-emerald-700">Ready</strong> (สีเขียว) ไม่ใช่ Error (หาก Error ให้กดเข้าไปดู Log เพราะถ้า Build พลาด Vercel จะยังเปิดใช้ตัวเก่า v1.5.1 ค้างไว้)
          </li>
          <li>
            ทดสอบเปิด <code className="bg-white px-1 rounded">https://ลิงก์เว็บของคุณ/api/health</code> — หากขึ้นเป็น <code className="bg-white px-1 rounded">"version":"{APP_VERSION}"</code> แต่หน้าหลักยังเป็นเวอร์ชันเก่า แสดงว่าเบราว์เซอร์จำแคช Service Worker ของ 1.5.1 อยู่ ให้เปิดในโหมดไม่ระบุตัวตน (Incognito) หรือล้าง Site Data ใน Chrome และลบไอคอนเก่าบนหน้าจอมือถือแล้วติดตั้งใหม่
          </li>
        </ol>
      </div>
    </div>
  );
};
