import { Platform } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MonthlyReportData {
  month: string; // e.g. "October 2023" or "All Time"
  generatedAt: string;
  total: number;
  pending: number;
  investigating: number;
  resolved: number;
  rejected: number;
  summons: number;
  resolutionRate: number;
  categories: { name: string; count: number }[];
  registeredResidents: number;
  pendingApprovals: number;
  publishedBulletins: number;
  rows: {
    id: string;
    title: string;
    category: string;
    status: string;
    priority: string;
    reportedBy: string;
    assignee: string;
    date: string;
  }[];
}

// ─── HTML builder ───────────────────────────────────────────────────────────
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml(d: MonthlyReportData): string {
  const statCards = [
    { label: 'Total Reports', value: d.total },
    { label: 'Pending', value: d.pending },
    { label: 'Investigating', value: d.investigating },
    { label: 'Resolved', value: d.resolved },
    { label: 'Rejected', value: d.rejected },
    { label: 'Summon Cases', value: d.summons },
  ]
    .map(
      (s) => `
      <div class="stat">
        <div class="stat-num">${s.value}</div>
        <div class="stat-label">${esc(s.label)}</div>
      </div>`,
    )
    .join('');

  const categoryRows = d.categories.length
    ? d.categories
        .map(
          (c) => `
        <tr>
          <td>${esc(c.name)}</td>
          <td class="num">${c.count}</td>
          <td class="num">${d.total > 0 ? Math.round((c.count / d.total) * 100) : 0}%</td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="3" class="muted">No data</td></tr>`;

  const complaintRows = d.rows.length
    ? d.rows
        .map(
          (r) => `
        <tr>
          <td>${esc(r.id)}</td>
          <td>${esc(r.title)}</td>
          <td>${esc(r.category)}</td>
          <td>${esc(r.status)}</td>
          <td>${esc(r.priority)}</td>
          <td>${esc(r.reportedBy)}</td>
          <td>${esc(r.assignee)}</td>
          <td>${esc(r.date)}</td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="8" class="muted">No complaints in this period</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Barangay Bangbang — Monthly Analytics Report (${esc(d.month)})</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #151c22;
    margin: 0;
    padding: 32px 40px;
    font-size: 13px;
    line-height: 1.5;
  }
  .header {
    text-align: center;
    border-bottom: 3px solid #00193c;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .header h1 { margin: 0; font-size: 20px; color: #00193c; }
  .header .sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .header .form { font-size: 11px; color: #6b7280; margin-top: 6px; }
  .period {
    background: #f0f4ff;
    border: 1px solid #c7d2fe;
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
  .period strong { color: #00193c; }
  h2 {
    font-size: 14px;
    color: #00193c;
    border-bottom: 1px solid #c4c6d1;
    padding-bottom: 6px;
    margin: 24px 0 12px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 8px;
  }
  .stat {
    border: 1px solid #c4c6d1;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }
  .stat-num { font-size: 24px; font-weight: 800; color: #00193c; }
  .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .rate {
    font-size: 15px;
    margin: 8px 0 16px;
  }
  .rate strong { font-size: 22px; color: #15803d; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 8px;
  }
  th, td {
    border: 1px solid #c4c6d1;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f3f4f6; font-weight: 700; }
  td.num, th.num { text-align: right; }
  .muted { color: #6b7280; text-align: center; font-style: italic; }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #c4c6d1;
    font-size: 10px;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }
  .sign-row {
    display: flex;
    justify-content: space-between;
    margin-top: 48px;
    gap: 40px;
  }
  .sign {
    flex: 1;
    text-align: center;
    font-size: 11px;
  }
  .sign .line {
    border-top: 1px solid #151c22;
    margin-bottom: 4px;
    padding-top: 40px;
  }
  @media print {
    body { padding: 0; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Republic of the Philippines</h1>
    <div class="sub">Barangay Bangbang &bull; Office of the Barangay Captain</div>
    <div class="form">Monthly Complaint Analytics Report</div>
  </div>

  <div class="period">
    <span>Reporting Period: <strong>${esc(d.month)}</strong></span>
    <span>Generated: ${esc(d.generatedAt)}</span>
  </div>

  <h2>Complaint Summary</h2>
  <div class="stats">${statCards}</div>
  <div class="rate">Resolution Rate: <strong>${d.resolutionRate}%</strong> &nbsp;(${d.resolved} resolved out of ${d.total} total)</div>

  <h2>Complaints by Category</h2>
  <table>
    <thead><tr><th>Category</th><th class="num">Count</th><th class="num">Share</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <h2>Barangay Overview</h2>
  <table>
    <tbody>
      <tr><td>Registered Residents</td><td class="num">${d.registeredResidents}</td></tr>
      <tr><td>Pending Account Approvals</td><td class="num">${d.pendingApprovals}</td></tr>
      <tr><td>Published Bulletins</td><td class="num">${d.publishedBulletins}</td></tr>
    </tbody>
  </table>

  <h2>Complaint Register (${d.rows.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Ref</th><th>Title</th><th>Category</th><th>Status</th>
        <th>Priority</th><th>Reported By</th><th>Assigned</th><th>Date</th>
      </tr>
    </thead>
    <tbody>${complaintRows}</tbody>
  </table>

  <div class="sign-row">
    <div class="sign"><div class="line"></div>Prepared by (Barangay Secretary)</div>
    <div class="sign"><div class="line"></div>Approved by (Barangay Captain)</div>
  </div>

  <div class="footer">
    <span>Barangay Bangbang Civic Portal</span>
    <span>This is a system-generated report.</span>
  </div>

  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;
}

// ─── Shared web print mechanism ───────────────────────────────────────────────
function printHtml(html: string, label: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    // Native printing would need expo-print; this build targets web.
    console.warn(`${label} is only supported on web.`);
    return;
  }

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    // Popup blocked — fall back to writing into a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ─── Public API ─────────────────────────────────────────────────────────────
export function printMonthlyReport(data: MonthlyReportData): void {
  printHtml(buildHtml(data), 'printMonthlyReport');
}

// ─── Patawag (KP Form No. 9) ─────────────────────────────────────────────────
export interface PatawagData {
  caseId: string;
  dateFiled: string;
  complainant: string;
  respondent: string;
  respondentAddress: string;
  cause: string;
  noticeStage: string;
  hearingDate: string;
  venue: string;
  presidingOfficer: string;
}

function buildPatawagHtml(d: PatawagData): string {
  const row = (label: string, value: string) => `
    <tr><td class="lbl">${esc(label)}</td><td>${esc(value)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Patawag — ${esc(d.caseId)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Georgia, serif;
    color: #151c22;
    margin: 0;
    padding: 40px 48px;
    font-size: 14px;
    line-height: 1.6;
  }
  .header { text-align: center; margin-bottom: 8px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header .sub { font-size: 13px; }
  .header .form { font-size: 12px; color: #444; margin-top: 6px; font-style: italic; }
  hr { border: none; border-top: 2px solid #00193c; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 20px; }
  td { padding: 6px 4px; vertical-align: top; border-bottom: 1px solid #d9d9d9; white-space: pre-line; }
  td.lbl { font-weight: bold; width: 180px; }
  .body-text { text-align: justify; margin: 16px 0; }
  .sign-row { display: flex; justify-content: flex-end; margin-top: 56px; }
  .sign { text-align: center; font-size: 13px; width: 260px; }
  .sign .line { border-top: 1px solid #151c22; margin-bottom: 4px; padding-top: 40px; }
  @media print { body { padding: 0; } @page { margin: 18mm; } }
</style>
</head>
<body>
  <div class="header">
    <h1>Republic of the Philippines</h1>
    <div class="sub">Barangay Bangbang &bull; Katarungang Pambarangay</div>
    <div class="form">KP Form No. 9 — Summon (Patawag)</div>
  </div>
  <hr />
  <table>
    ${row('Case Reference', d.caseId)}
    ${row('Date Filed', d.dateFiled)}
    ${row('Complainant', d.complainant)}
    ${row('Respondent', d.respondent)}
    ${row('Address', d.respondentAddress)}
    ${row('Cause of Action', d.cause)}
    ${row('Notice Stage', d.noticeStage)}
    ${row('Hearing Date', d.hearingDate)}
    ${row('Venue', d.venue)}
    ${row('Presiding Officer', d.presidingOfficer)}
  </table>
  <p class="body-text">
    You are hereby summoned to appear before the Lupong Tagapamayapa of Barangay
    Bangbang at the time, date, and venue stated above for conciliation
    proceedings. Failure to appear may result in further legal action under the
    Katarungang Pambarangay Law (PD 1508 / RA 7160).
  </p>
  <div class="sign-row">
    <div class="sign"><div class="line"></div>${esc(d.presidingOfficer)}<br/>Presiding Officer</div>
  </div>
  <script>
    window.onload = function () { window.focus(); window.print(); };
  </script>
</body>
</html>`;
}

export function printPatawag(data: PatawagData): void {
  printHtml(buildPatawagHtml(data), 'printPatawag');
}
