export class DailyReportLimitError extends Error {
  constructor(
    message = 'You have reached the limit of 3 reports for today. Please try again tomorrow.',
    readonly remaining = 0,
    readonly resetAt?: string,
  ) {
    super(message);
    this.name = 'DailyReportLimitError';
  }
}

export const DAILY_REPORT_LIMIT = 3;

export interface DailyReportUsage {
  used: number;
  remaining: number;
  limit: number;
  resetAt?: string | null;
}
