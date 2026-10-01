// Motor de exportación (Excel, PDF, CSV, impresión) según files/04, files/08 y prototipo HTML
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Store, AuthService, Audit } from './store';
import { todayIso, fdate, nowStamp, esc } from './format';

export interface ExportCol {
  k?: string;
  l: string;
  x?: (row: any) => any;
  sv?: (row: any) => any;
}

export function saveFile(filename: string, data: Blob | string, mime?: string) {
  if (typeof window === 'undefined') return;
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  } catch (e) {
    console.error('Error al descargar archivo:', e);
  }
}

export function exportRows(
  arg1: 'xlsx' | 'pdf' | 'csv' | 'print' | string,
  arg2: any,
  arg3?: any,
  arg4?: any
) {
  if (!AuthService.guard('exportar')) return;

  let fmt: string;
  let title: string;
  let cols: ExportCol[];
  let rows: any[];

  if (['xlsx', 'pdf', 'csv', 'print'].includes(arg1)) {
    fmt = arg1;
    title = String(arg2);
    cols = arg3 || [];
    rows = arg4 || [];
  } else {
    title = String(arg1);
    cols = arg2 || [];
    rows = arg3 || [];
    fmt = typeof arg4 === 'string' ? arg4 : 'xlsx';
  }

  const fname = title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '') + '-' + todayIso();
  const head = cols.map((c) => c.l);
  const body = rows.map((r) =>
    cols.map((c) => {
      const v = (c as any).r ? (c as any).r(r) : c.x ? c.x(r) : (c.k ? r[c.k] : '');
      return v == null ? '' : v;
    })
  );

  if (fmt === 'xlsx') {
    const ws = XLSX.utils.aoa_to_sheet([
      [title],
      ['Generado: ' + nowStamp() + ' — ' + AuthService.currentUser().nombre],
      [],
      head,
      ...body
    ]);
    ws['!cols'] = head.map((h) => ({ wch: Math.max(12, Math.min(48, h.length + 6)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveFile(fname + '.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } else if (fmt === 'pdf') {
    const doc = new jsPDF({
      orientation: head.length > 6 ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    doc.setFontSize(14);
    doc.setTextColor(23, 38, 43);
    doc.text('Seven Save', 36, 36);
    doc.setFontSize(11);
    doc.text(title, 36, 54);
    doc.setFontSize(8.5);
    doc.setTextColor(94, 110, 115);
    doc.text(
      'Generado el ' + fdate(todayIso()) + ' por ' + AuthService.currentUser().nombre + ' (' + AuthService.currentUser().rol + ')',
      36,
      68
    );
    autoTable(doc, {
      head: [head],
      body: body.map((r) =>
        r.map((v) => (typeof v === 'number' ? v.toLocaleString('es-CO') : String(v)))
      ),
      startY: 80,
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [11, 110, 104] },
      alternateRowStyles: { fillColor: [246, 249, 249] }
    });
    saveFile(fname + '.pdf', doc.output('blob'));
  } else if (fmt === 'csv') {
    const csv = [head, ...body]
      .map((r) =>
        r
          .map((v) => {
            const str = String(v).replace(/"/g, '""');
            return /[;"\n]/.test(str) ? `"${str}"` : str;
          })
          .join(';')
      )
      .join('\n');
    saveFile(fname + '.csv', '\ufeff' + csv, 'text/csv');
  } else if (fmt === 'print') {
    if (typeof window === 'undefined') return;
    const w = window.open('', '_blank');
    const html = `<html><head><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;font-size:11px;color:#17262B;margin:24px}h1{font-size:16px;margin:0}p{color:#5E6E73}table{border-collapse:collapse;width:100%}th{background:#0F8579;color:#fff;text-align:left}th,td{padding:5px 6px;border:1px solid #dde4e6}tr:nth-child(even) td{background:#F6F9F9}</style></head><body><h1>${esc(title)}</h1><p>Seven Save · ${fdate(todayIso())} · ${esc(AuthService.currentUser().nombre)}</p><table><thead><tr>${head.map((h) => '<th>' + esc(h) + '</th>').join('')}</tr></thead><tbody>${body.map((r) => '<tr>' + r.map((v) => '<td>' + esc(typeof v === 'number' ? v.toLocaleString('es-CO') : v) + '</td>').join('') + '</tr>').join('')}</tbody></table></body></html>`;
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        try {
          w.print();
        } catch {}
      }, 300);
    }
  }

  Audit.log({ modulo: 'Reportes', accion: 'Exportación', campo: fmt.toUpperCase(), nuevo: title });
  Store.persist();
}
