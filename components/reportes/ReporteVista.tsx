"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Surface,
  TableViewport,
  DataTable,
  EmptyState,
  FormGrid,
} from "@/components/ui/Workspace";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/icons";
import { construirReporte, exportReporte, type ReportDef } from "./catalogo";

const PAGE_SIZE = 15;
type Formato = "xlsx" | "pdf" | "csv" | "print";

/**
 * VISTA dedicada de un reporte (reemplaza al modal de vista previa).
 * Mantiene filtros/permisos de origen: el catálogo, los builders, la
 * exportación y la paginación son los del flujo original.
 */
export const ReporteVista = ({
  report,
  onBack,
}: {
  report: ReportDef;
  onBack: () => void;
}) => {
  const [pagina, setPagina] = useState(1);
  const [reintento, setReintento] = useState(0);

  // Construcción protegida en cada render (los datos son del store actual)
  const data = construirReporte(report);
  const total = data?.rows.length ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const filas = data
    ? data.rows.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE)
    : [];

  const exportar = (f: Formato) => exportReporte(report, f);

  return (
    <div className="anim-fade-rise">
      {/* Breadcrumb de navegación contextual */}
      <nav
        className="crumb mb"
        aria-label="Ruta de navegación"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <Link
          href="/reportes"
          className="text-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 500,
          }}
        >
          <Icon name="chevron-left" size={13} /> Reportes
        </Link>
        <span style={{ color: "var(--muted)" }}>/</span>
        <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>
          {report.t}
        </span>
      </nav>

      <PageHeader variant="plain" className="ph">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              aria-hidden="true"
              style={{
                width: 46,
                height: 46,
                borderRadius: "var(--r)",
                background: "var(--brand-soft)",
                color: "var(--brand-2)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon name={report.ic} size={24} />
            </span>
            <div>
              <h1
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: 0,
                  flexWrap: "wrap",
                }}
              >
                {report.t}
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--brand-soft)",
                    color: "var(--brand-2)",
                  }}
                >
                  {data ? `${total} registros` : "—"}
                </span>
              </h1>
              <p style={{ margin: "4px 0 0" }}>{report.d}</p>
            </div>
          </div>
        </div>

        {/* Acciones del reporte: exportación y retorno al índice */}
        <div
          className="ph-actions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Button
            className="btn ghost"
            onClick={onBack}
            title="Volver al índice de reportes"
          >
            <Icon name="chevron-left" /> Volver
          </Button>
          <Button
            className="btn"
            onClick={() => exportar("xlsx")}
            disabled={!data}
            title="Exportar a Excel"
          >
            <Icon name="file-excel" /> Excel
          </Button>
          <Button
            className="btn"
            onClick={() => exportar("pdf")}
            disabled={!data}
            title="Exportar a PDF"
          >
            <Icon name="file-pdf" /> PDF
          </Button>
          <Button
            className="btn"
            onClick={() => exportar("csv")}
            disabled={!data}
            title="Exportar a CSV"
          >
            <Icon name="file-csv" /> CSV
          </Button>
          <Button
            className="btn"
            onClick={() => exportar("print")}
            disabled={!data}
            title="Imprimir reporte"
          >
            <Icon name="printer" /> Imprimir
          </Button>
        </div>
      </PageHeader>

      <Surface className="panel mb" key={reintento}>
        <SectionHeader
          as="h2"
          icon={report.ic}
          title="Contexto del reporte"
          description={`Vista previa de datos · ${data ? `${total} registros` : 'Calculando datos'}`}
        />
        <div className="panel-b" style={{ paddingBottom: 0 }}>
          <FormGrid role="group" aria-label="Contexto del reporte">
            <div><span className="small muted">Cobertura</span><b>{report.d}</b></div>
            <div><span className="small muted">Registros disponibles</span><b aria-live="polite">{data ? total : '—'}</b></div>
            <div><span className="small muted">Actualización</span><b>Al generar</b></div>
          </FormGrid>
        </div>
        {!data ? (
          <div className="panel-b np">
            <EmptyState
              title="No se pudo preparar el reporte"
              description="Ocurrió un error al calcular los datos. Vuelve al índice e inténtalo de nuevo."
              action={
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    className="btn pri"
                    onClick={() => setReintento((n) => n + 1)}
                  >
                    Reintentar
                  </Button>
                  <Button className="btn" onClick={onBack}>
                    <Icon name="chevron-left" /> Volver al índice
                  </Button>
                </div>
              }
            />
          </div>
        ) : total === 0 ? (
          <div className="panel-b np">
            <EmptyState
              title="Sin registros para este reporte"
              description="Cuando existan datos del tipo que cubre este reporte, la vista y sus exportaciones los incluirán."
              action={
                <Button className="btn pri" onClick={onBack}>
                  <Icon name="chevron-left" /> Volver al índice
                </Button>
              }
            />
          </div>
        ) : (
          <div className="panel-b">
            <div
              className="row-flex"
              style={{
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <span className="small muted" aria-live="polite">
                Total registros: <b>{total}</b> · Página {paginaSegura} de{" "}
                {totalPaginas}
              </span>
              <span className="small muted">
                <Icon name="info" /> Los datos se calculan al momento de
                generar.
              </span>
            </div>

            <TableViewport
              className="tbl-wrap"
              aria-label={`Datos del reporte ${report.t}`}
            >
              <DataTable layout="readable" aria-label={`Tabla del reporte ${report.t}`}>
                <thead>
                  <tr>
                    {data.cols.map((col, idx) => (
                      <th key={idx} className={col.num ? "num" : ""}>
                        {col.l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {data.cols.map((col, cIdx) => {
                        let val: any = "";
                        if (col.r) val = col.r(row);
                        else if (col.x) val = col.x(row);
                        else if (col.k) val = row[col.k];
                        return (
                          <td
                            key={cIdx}
                            className={col.num ? "num" : ""}
                            title={val != null ? String(val) : undefined}
                          >
                            {val != null && String(val) !== ""
                              ? String(val)
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableViewport>

            {totalPaginas > 1 && (
              <div
                className="row-flex"
                style={{ justifyContent: "center", marginTop: 14, gap: 10 }}
              >
                <Button
                  className="btn sm xs"
                  disabled={paginaSegura <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="small muted" aria-live="polite">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <Button
                  className="btn sm xs"
                  disabled={paginaSegura >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        )}
      </Surface>
    </div>
  );
};
