import api from '../api';
import { unwrapList } from './apiAdapters';
import * as XLSX from 'xlsx';

/**
 * Clean query params by removing undefined, null, and empty strings
 */
const cleanParams = (params = {}) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

// 1. Report Summary
export const fetchReportSummary = async () => {
  const { data } = await api.get('/reports/summary');
  return data;
};

// 2. Unapproved Members Report
export const fetchUnapprovedMembersReport = async (params = {}) => {
  const { data } = await api.get('/reports/unapproved-members', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

// 3. All Approved Members Report
export const fetchMembersReport = async (params = {}) => {
  const { data } = await api.get('/reports/members', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

// 4. Members by Geography
export const fetchMembersByGeography = async (params = {}) => {
  const { data } = await api.get('/reports/members/by-geography', {
    params: cleanParams(params),
  });
  return Array.isArray(data) ? data : unwrapList(data);
};

// 5. Members by Gender
export const fetchMembersByGender = async (params = {}) => {
  const { data } = await api.get('/reports/members/by-gender', {
    params: cleanParams(params),
  });
  return Array.isArray(data) ? data : unwrapList(data);
};

// 6. Members by Membership Type
export const fetchMembersByMembershipType = async (params = {}) => {
  const { data } = await api.get('/reports/members/by-membership-type', {
    params: cleanParams(params),
  });
  return Array.isArray(data) ? data : unwrapList(data);
};

// 7. Labels Report (Pending / Generated)
export const fetchLabelsReport = async (params = {}) => {
  const { data } = await api.get('/reports/labels', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

// 8. Magazine Returns Report
export const fetchMagazineReturnsReport = async (params = {}) => {
  const { data } = await api.get('/reports/magazine-returns', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

// 9. Receipt Reports
export const fetchReceiptsReport = async (params = {}) => {
  const { data } = await api.get('/reports/receipts', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

// 10. Receipt Reports by Member
export const fetchReceiptsByMemberReport = async (params = {}) => {
  const { data } = await api.get('/reports/receipts/by-member', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

// 11. Saved Reports CRUD
export const fetchSavedReports = async (params = {}) => {
  const { data } = await api.get('/reports/saved', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

export const fetchSavedReportById = async (id) => {
  const { data } = await api.get(`/reports/saved/${id}`);
  return data;
};

export const createSavedReport = async (payload) => {
  const { data } = await api.post('/reports/saved', payload);
  return data;
};

export const updateSavedReport = async (id, payload) => {
  const { data } = await api.put(`/reports/saved/${id}`, payload);
  return data;
};

export const deleteSavedReport = async (id) => {
  const { data } = await api.delete(`/reports/saved/${id}`);
  return data;
};

// 12. Export Logs
export const fetchExportLogs = async (params = {}) => {
  const { data } = await api.get('/reports/export-logs', {
    params: cleanParams(params),
  });
  return unwrapList(data);
};

/**
 * Trigger browser file download from Blob or URL
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Download CSV from backend export param, with client-side fallback if backend returns JSON
 */
export const exportReportEndpoint = async (endpoint, params = {}, filename = 'report.csv') => {
  try {
    const response = await api.get(endpoint, {
      params: { ...cleanParams(params), export: 'csv' },
      responseType: 'blob',
    });
    downloadBlob(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }), filename);
    return true;
  } catch (err) {
    console.error('Backend export failed, attempting client-side CSV format', err);
    throw err;
  }
};

/**
 * Export data array to CSV client-side
 */
export const exportRowsToCsv = (columns, rows, filename = 'report.csv') => {
  if (!rows || rows.length === 0) return false;
  
  const headers = columns.map((c) => `"${String(c.label || c.key).replace(/"/g, '""')}"`).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        let val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.key];
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers, ...lines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
  return true;
};

/**
 * Export data array to native Excel format (.xlsx) client-side
 */
export const exportRowsToExcel = (columns, rows, filename = 'report.xlsx') => {
  if (!rows || rows.length === 0) return false;

  const data = rows.map((row) => {
    const item = {};
    columns.forEach((col) => {
      let val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.key];
      if (val === null || val === undefined) val = '';
      item[col.label || col.key] = val;
    });
    return item;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  
  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.csv$/, '')}.xlsx`;
  XLSX.writeFile(workbook, finalFilename);
  return true;
};
