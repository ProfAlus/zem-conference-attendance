// ============================================================
// MODULE: Reports
// ============================================================

import { renderShell } from '../core/nav.js';
import { apiCall } from '../core/api.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { escapeHtml, downloadBlob, formatDate } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

const content = renderShell('reports.html', 'Reports', 'admin');
let allParticipants = [];
let filtered = [];
let conferenceDays = 3;
let dayLabels = [];
let conferenceName = CONFIG.DEFAULTS.conferenceName;
let venue = '';

if (content) init();

async function init() {
  content.innerHTML = `
    <div class="card mb-4 no-print">
      <div class="flex-wrap flex gap-3" style="align-items:flex-end;">
        <div class="field" style="margin:0; min-width:180px;">
          <label for="churchFilter">Church</label>
          <select class="input" id="churchFilter"><option value="">All churches</option></select>
        </div>
        <div class="field" style="margin:0; min-width:140px;">
          <label for="genderFilter">Gender</label>
          <select class="input" id="genderFilter"><option value="">All</option>${CONFIG.GENDERS.map((g) => `<option value="${g}">${g}</option>`).join('')}</select>
        </div>
        <div class="field" style="margin:0; min-width:160px;">
          <label for="dayFilter">Attended day</label>
          <select class="input" id="dayFilter"><option value="">Any</option></select>
        </div>
        <button class="btn btn-outline" id="applyBtn"><i class="fa-solid fa-filter"></i> Apply</button>
        <div style="flex:1;"></div>
        <button class="btn btn-outline" id="exportExcel"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
        <button class="btn btn-outline" id="exportPdf"><i class="fa-solid fa-file-pdf"></i> Export PDF</button>
        <button class="btn btn-outline" id="printBtn"><i class="fa-solid fa-print"></i> Print (data view)</button>
        <button class="btn btn-dark" id="printRegisterBtn"><i class="fa-solid fa-file-lines"></i> Print Attendance Register</button>
      </div>
    </div>

    <div class="card" id="reportCard">
      <div class="flex-between mb-4">
        <h3 id="reportTitle" style="margin:0;">Attendance report</h3>
        <span class="text-muted" id="countLabel"></span>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="table">
          <thead><tr id="headRow"></tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const settings = await apiCall('getSettings');
    conferenceDays = settings.conferenceDays || 3;
    conferenceName = settings.conferenceName || conferenceName;
    venue = settings.venue || '';
    dayLabels = settings.dayLabels || [];
  } catch { /* defaults */ }
  if (!dayLabels.length) {
    dayLabels = Array.from({ length: conferenceDays }, (_, i) => ({ day: i + 1, label: `Day ${i + 1}`, short: `D${i + 1}` }));
  }

  document.getElementById('dayFilter').innerHTML = '<option value="">Any</option>' +
    dayLabels.map((d) => `<option value="${d.day}">${d.label}</option>`).join('');

  buildHeader();

  document.getElementById('applyBtn').addEventListener('click', applyFilters);
  document.getElementById('exportExcel').addEventListener('click', exportExcel);
  document.getElementById('exportPdf').addEventListener('click', exportPdf);
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('printRegisterBtn').addEventListener('click', printAttendanceRegister);

  await loadData();
}

function buildHeader() {
  const days = dayLabels.map((d) => `<th>${d.short}</th>`).join('');
  document.getElementById('headRow').innerHTML = `<th>Name</th><th>Phone</th><th>Church</th><th>Gender</th><th>Age</th>${days}<th>Registered</th>`;
}

async function loadData() {
  document.getElementById('tbody').innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    allParticipants = await apiCall('getParticipants');
    const churches = [...new Set(allParticipants.map((p) => p.church))].sort();
    document.getElementById('churchFilter').innerHTML = '<option value="">All churches</option>' +
      churches.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    applyFilters();
  } catch (err) {
    toastError(err.message);
  }
}

function applyFilters() {
  const church = document.getElementById('churchFilter').value;
  const gender = document.getElementById('genderFilter').value;
  const day = document.getElementById('dayFilter').value;

  filtered = allParticipants.filter((p) => {
    if (church && p.church !== church) return false;
    if (gender && p.gender !== gender) return false;
    if (day && !p.attendance[Number(day) - 1]) return false;
    return true;
  });

  document.getElementById('countLabel').textContent = `${filtered.length} participants`;
  document.getElementById('tbody').innerHTML = filtered.map((p) => `
    <tr>
      <td>${escapeHtml(p.fullName)}</td>
      <td>${escapeHtml(p.phone)}</td>
      <td>${escapeHtml(p.church)}</td>
      <td>${escapeHtml(p.gender)}</td>
      <td>${escapeHtml(p.ageGroup)}</td>
      ${p.attendance.map((present) => `<td>${present ? '<span class="badge badge-success">Present</span>' : '<span class="badge badge-neutral">—</span>'}</td>`).join('')}
      <td>${formatDate(p.registrationDate)}</td>
    </tr>
  `).join('');
}

function tableRows() {
  const dayHeaders = dayLabels.map((d) => d.label);
  const header = ['Name', 'Phone', 'Church', 'Gender', 'Age Group', ...dayHeaders, 'Registered'];
  const rows = filtered.map((p) => [
    p.fullName, p.phone, p.church, p.gender, p.ageGroup,
    ...p.attendance.map((present) => (present ? 'Present' : '—')),
    formatDate(p.registrationDate),
  ]);
  return { header, rows };
}

function exportExcel() {
  const { header, rows } = tableRows();
  // eslint-disable-next-line no-undef
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Force the Phone column to explicit text type — otherwise Excel/Sheets
  // can treat digit-only values as numbers and silently drop a leading 0,
  // which is exactly the phone-number format used on the registration form.
  const phoneCol = header.indexOf('Phone');
  if (phoneCol !== -1) {
    for (let r = 1; r <= rows.length; r++) {
      // eslint-disable-next-line no-undef
      const addr = XLSX.utils.encode_cell({ r, c: phoneCol });
      if (ws[addr]) {
        ws[addr].t = 's';
        ws[addr].z = '@';
        ws[addr].v = String(ws[addr].v);
      }
    }
  }

  // eslint-disable-next-line no-undef
  const wb = XLSX.utils.book_new();
  // eslint-disable-next-line no-undef
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
  // eslint-disable-next-line no-undef
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/octet-stream' }), `${conferenceName.replace(/\s+/g, '-')}-report.xlsx`);
  toastSuccess('Excel report downloaded.');
}

/**
 * Renders a printable page laid out like the physical paper register:
 * a Programme / Place / Date header, then a numbered S/N table with
 * Names, Church, Phone No, and one tick-box column per conference day.
 * Opens in a new tab so it doesn't inherit the app's sidebar/theme.
 */
function printAttendanceRegister() {
  if (!filtered.length) {
    toastError('No participants to print for the current filters.');
    return;
  }

  const dayHeaders = dayLabels.map((d) => d.short);
  const today = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  const rows = filtered.map((p, idx) => `
    <tr>
      <td class="sn">${idx + 1}</td>
      <td class="name">${escapeHtml(p.fullName)}</td>
      <td>${escapeHtml(p.church)}</td>
      <td>${escapeHtml(p.phone)}</td>
      ${p.attendance.map((present) => `<td class="tick">${present ? '&#10003;' : ''}</td>`).join('')}
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(conferenceName)} — Attendance Register</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 16px; text-transform: uppercase; text-align: center; margin: 0 0 4px; letter-spacing: 0.03em; }
  .subtitle { text-align: center; font-size: 12px; margin: 0 0 18px; }
  .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 14px; }
  .meta span { border-bottom: 1px solid #111; padding: 0 4px 2px; min-width: 140px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #111; padding: 5px 6px; text-align: left; }
  th { text-align: center; background: #f0f0f0; }
  td.sn { text-align: center; width: 28px; }
  td.tick { text-align: center; width: 26px; font-weight: bold; }
  td.name { min-width: 150px; }
  @media print {
    body { margin: 10mm; }
    @page { size: A4 landscape; margin: 10mm; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(conferenceName)}</h1>
  <p class="subtitle">Attendance Register</p>
  <div class="meta">
    <div>Programme: <span>${escapeHtml(conferenceName)}</span></div>
    <div>Place: <span>${escapeHtml(venue || '\u00A0'.repeat(20))}</span></div>
    <div>Date: <span>${escapeHtml(today)}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>S/N</th><th>Names</th><th>Church</th><th>Phone No</th>${dayHeaders.map((d) => `<th>${d}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    toastError('Please allow pop-ups to print the register.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => win.print();
}

function exportPdf() {
  const { header, rows } = tableRows();
  // eslint-disable-next-line no-undef
  const doc = new jspdf.jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(`${conferenceName} — Attendance Report`, 14, 16);
  doc.autoTable({ head: [header], body: rows, startY: 22, styles: { fontSize: 8 } });
  doc.save(`${conferenceName.replace(/\s+/g, '-')}-report.pdf`);
  toastSuccess('PDF report downloaded.');
}
