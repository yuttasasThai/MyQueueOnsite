import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isQuotaError: false,
      isPermissionError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const rawMsg = error?.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
    let displayMsg = rawMsg;
    let isQuotaError = rawMsg.toLowerCase().includes('quota');
    let isPermissionError = rawMsg.toLowerCase().includes('permission');

    try {
      const parsed = JSON.parse(rawMsg) as Partial<FirestoreErrorInfo>;
      if (parsed && typeof parsed.error === 'string') {
        displayMsg = `${parsed.error}${parsed.path ? ` (${parsed.operationType || 'read'}: ${parsed.path})` : ''}`;
        isQuotaError = isQuotaError || parsed.error.toLowerCase().includes('quota');
        isPermissionError =
          isPermissionError || parsed.error.toLowerCase().includes('permission');
      }
    } catch {
      // Non-JSON runtime error
    }

    return {
      hasError: true,
      errorMessage: displayMsg,
      isQuotaError,
      isPermissionError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-['Prompt',sans-serif]">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl border border-red-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900">
                {this.state.isQuotaError
                  ? 'โควต้าฐานข้อมูลคลาวด์เต็มชั่วคราว'
                  : this.state.isPermissionError
                  ? 'สิทธิ์การเข้าถึงฐานข้อมูลไม่ถูกต้อง'
                  : 'เกิดข้อผิดพลาดในการแสดงผล'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {this.state.isQuotaError
                  ? 'ระบบใช้งานฐานข้อมูลเกินโควต้าฟรีประจำวัน โควต้าจะรีเซ็ตใหม่ในวันถัดไป ข้อมูลในเครื่องของท่านยังคงปลอดภัย'
                  : 'กรุณารีเฟรชหน้าเว็บหรือเข้าสู่ระบบ Google ใหม่อีกครั้ง หากปัญหายังคงอยู่สามารถแจ้งผู้ดูแลระบบได้'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 break-words text-left max-h-32 overflow-y-auto">
              {this.state.errorMessage}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({
                    hasError: false,
                    errorMessage: '',
                    isQuotaError: false,
                    isPermissionError: false,
                  });
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ลองใหม่
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>รีเฟรชหน้าเว็บ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
