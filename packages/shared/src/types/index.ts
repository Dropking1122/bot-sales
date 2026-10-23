export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SALES';

export type MotorcycleCondition = 'BARU' | 'BEKAS';

export type StockStatus = 'TERSEDIA' | 'INDENT' | 'HABIS';

export type ConsentStatus = 'GRANTED' | 'PENDING' | 'DENIED' | 'OPT_OUT';

export type BroadcastStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'SCHEDULED'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type RecipientStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export type LeadStatus =
  | 'BARU'
  | 'DIHUBUNGI'
  | 'TERTARIK'
  | 'NEGOSIASI'
  | 'MENUNGGU_KEPUTUSAN'
  | 'BERHASIL'
  | 'TIDAK_BERHASIL';

export type ImportStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ImportStrategy =
  | 'INSERT_ONLY'
  | 'UPDATE_ONLY'
  | 'UPSERT'
  | 'SKIP_EXISTING'
  | 'ABORT_ON_ERROR';

export type WhatsAppStatus =
  | 'DISCONNECTED'
  | 'INITIALIZING'
  | 'QR_READY'
  | 'AUTHENTICATED'
  | 'CONNECTED'
  | 'AUTH_FAILURE';

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FinancingSimulationRequest {
  hargaOtr: number;
  dpAmount: number;
  tenorMonths: number;
  interestRateAnnual?: number;
  adminFee?: number;
  insuranceFee?: number;
}

export interface FinancingSimulationResult {
  hargaOtr: number;
  dpAmount: number;
  dpPercentage: number;
  principalLoan: number;
  tenorMonths: number;
  interestRateAnnual: number;
  adminFee: number;
  insuranceFee: number;
  monthlyInstallment: number;
  totalPayment: number;
  disclaimer: string;
}
