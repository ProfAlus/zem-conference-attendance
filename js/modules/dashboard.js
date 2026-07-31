// ============================================================
// MODULE: Dashboard
// ============================================================

import { renderShell } from '../core/nav.js';
import { apiCall } from '../core/api.js';
import { toastError } from '../core/toast.js';

const content = renderShell('dashboard.html', 'Dashboard', 'volunteer');
if (content) init();

async function init() {
  content.innerHTML = `
    <div class="loading-overlay" id="loadOverlay" style="position:static; background:none; padding: 40px 0;">
      <div class="spinner spinner-dark"></div>
      <span class="text-muted">Loading stats…</span>
    </div>
  `;

  try {
    const stats = await apiCall('getDashboardStats');
    renderDashboard(stats);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${err.message}</p></div>`;
    toastError(err.message);
  }
}

function renderDashboard(stats) {
  // Defensive defaults: if the deployed backend hasn't been updated to the
  // latest version yet, these fields may be missing from the response —
  // fall back to empty rather than crashing the whole dashboard.
  const attendanceByDay = stats.attendanceByDay || [];
  const topChurches = stats.topChurches || [];
  const ageGroups = stats.ageGroups || [];
  const genderByAge = stats.genderByAge || [];
  const dayLabels = stats.dayLabels || attendanceByDay.map((_, i) => ({ day: i + 1, label: `Day ${i + 1}`, short: `D${i + 1}`, axis: `Day ${i + 1}` }));

  const dayCards = attendanceByDay.map((count, i) => `
    <div class="stat-card" style="--accent: var(--color-teal)">
      <i class="fa-solid fa-calendar-check stat-icon"></i>
      <div class="stat-label">${dayLabels[i]?.label || `Day ${i + 1}`} Attendance</div>
      <div class="stat-value">${count}</div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="stat-grid mb-4">
      <div class="stat-card" style="--accent: var(--color-coral)">
        <i class="fa-solid fa-users stat-icon"></i>
        <div class="stat-label">Total Registered</div>
        <div class="stat-value">${stats.totalRegistered ?? 0}</div>
      </div>
      ${dayCards}
      <div class="stat-card" style="--accent: var(--color-gold)">
        <i class="fa-solid fa-mars stat-icon"></i>
        <div class="stat-label">Male Participants</div>
        <div class="stat-value">${stats.male ?? 0}</div>
      </div>
      <div class="stat-card" style="--accent: var(--color-gold)">
        <i class="fa-solid fa-venus stat-icon"></i>
        <div class="stat-label">Female Participants</div>
        <div class="stat-value">${stats.female ?? 0}</div>
      </div>
      <div class="stat-card" style="--accent: var(--color-ink-900)">
        <i class="fa-solid fa-place-of-worship stat-icon"></i>
        <div class="stat-label">Churches Represented</div>
        <div class="stat-value">${stats.churchesCount ?? 0}</div>
      </div>
      <div class="stat-card" style="--accent: var(--color-success)">
        <i class="fa-solid fa-user-plus stat-icon"></i>
        <div class="stat-label">New Registrations Today</div>
        <div class="stat-value">${stats.newToday ?? 0}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Attendance by day</h3>
        <canvas id="attendanceChart" height="220"></canvas>
      </div>
      <div class="card">
        <h3>Gender split</h3>
        <canvas id="genderChart" height="220"></canvas>
      </div>
    </div>

    <div class="card mt-6">
      <h3>Top churches by attendance</h3>
      <canvas id="churchChart" height="180"></canvas>
    </div>

    <div class="grid-2 mt-6">
      <div class="card">
        <h3>Age group distribution</h3>
        <canvas id="ageChart" height="220"></canvas>
      </div>
      <div class="card">
        <h3>Gender by age group</h3>
        <canvas id="genderAgeChart" height="220"></canvas>
      </div>
    </div>
  `;

  // eslint-disable-next-line no-undef
  const Chart_ = Chart;
  const palette = ['#FF6B4E', '#159895', '#F2B705', '#1B1640', '#E5484D', '#6B6785'];

  new Chart_(document.getElementById('attendanceChart'), {
    type: 'bar',
    data: {
      labels: dayLabels.map((d) => d.axis),
      datasets: [{ data: attendanceByDay, backgroundColor: '#FF6B4E', borderRadius: 8 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  new Chart_(document.getElementById('genderChart'), {
    type: 'doughnut',
    data: {
      labels: ['Male', 'Female'],
      datasets: [{ data: [stats.male, stats.female], backgroundColor: ['#159895', '#F2B705'] }],
    },
    options: { plugins: { legend: { position: 'bottom' } } },
  });

  new Chart_(document.getElementById('churchChart'), {
    type: 'bar',
    data: {
      labels: topChurches.map((c) => c.name),
      datasets: [{ data: topChurches.map((c) => c.count), backgroundColor: palette, borderRadius: 8 }],
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } } },
  });

  new Chart_(document.getElementById('ageChart'), {
    type: 'bar',
    data: {
      labels: ageGroups.map((a) => a.group),
      datasets: [{ data: ageGroups.map((a) => a.count), backgroundColor: '#1B1640', borderRadius: 8 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  new Chart_(document.getElementById('genderAgeChart'), {
    type: 'bar',
    data: {
      labels: genderByAge.map((a) => a.group),
      datasets: [
        { label: 'Male', data: genderByAge.map((a) => a.male), backgroundColor: '#159895', borderRadius: 6 },
        { label: 'Female', data: genderByAge.map((a) => a.female), backgroundColor: '#F2B705', borderRadius: 6 },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    },
  });
}
