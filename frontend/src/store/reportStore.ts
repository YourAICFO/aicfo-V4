import { create } from 'zustand';

/**
 * Shared selected reporting month (YYYY-MM) across dashboard, P&L, insights.
 * Default should be set from connectorStatusV1.snapshotLatestMonthKey or pl-months latest.
 */
interface ReportState {
  selectedReportMonth: string | null;
  setSelectedReportMonth: (month: string | null) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  selectedReportMonth: null,
  setSelectedReportMonth: (month) => set({ selectedReportMonth: month }),
}));
