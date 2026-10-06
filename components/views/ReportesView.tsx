"use client";
import { fieldIcon } from '../forms/fieldIcon';
import { Input } from "@/components/ui/Controls";
import { notify } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  ResourceCard,
  EmptyState,
} from "@/components/ui/Workspace";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { exportRows } from "@/lib/export";
import { Icon } from "@/components/icons";
import {
  REPORTES,
  filtrarReportes,
  exportReporte,
} from "@/components/reportes/catalogo";

/**
 * Índice de la biblioteca de reportes. La vista previa de cada reporte ya no
 * es un modal: se abre como VISTA dedicada en `/reportes/[reportKey]`.
 */
export const ReportesView: React.FC = () => {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const visibles = filtrarReportes(query);

  // Exportación real del índice: cada reporte con su descripción
  const handleExportCatalog = (format: "xlsx" | "csv" | "print") => {
    try {
      exportRows(
        "Catálogo de reportes",
        [
          { k: "t", l: "Reporte" },
          { k: "d", l: "Descripción" },
          { k: "f", l: "Formatos disponibles" },
        ],
        REPORTES.map((r) => ({
          t: r.t,
          d: r.d,
          f: "Excel · PDF · CSV · Impresión",
        })),
        format,
      );
    } catch (e) {
      console.error("Error exportando el catálogo de reportes:", e);
      notify("No se pudo exportar el catálogo. Intenta de nuevo.");
    }
  };

  const abrirReporte = (key: string) =>
    router.push(`/reportes/${encodeURIComponent(key)}`);

  return (
    <div className="view-content">
      {/* Banner de cabecera con gradiente de marca institucional */}
      <PageHeader variant="hero" className="ph">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--r)",
                background: "rgba(255, 255, 255, 0.16)",
                color: "var(--surface)",
                display: "grid",
                placeItems: "center",
                backdropFilter: "blur(8px)",
                flexShrink: 0,
              }}
            >
              <Icon name="file-chart" size={24} />
            </span>
            <div>
              <h1
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: 0,
                }}
              >
                Reportes
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: "var(--r-pill)",
                    background: "rgba(255, 255, 255, 0.18)",
                    color: "var(--surface)",
                  }}
                >
                  {REPORTES.length} disponibles
                </span>
              </h1>
              <p style={{ margin: "4px 0 0" }}>
                Biblioteca de {REPORTES.length} reportes exportables a Excel,
                PDF, CSV o impresión. Los datos se calculan al momento de
                generar.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones reales del módulo alineadas a la derecha */}
        <div className="ph-actions">
          <Button
            className="btn"
            onClick={() => handleExportCatalog("xlsx")}
            title="Descargar el índice de reportes como Excel"
          >
            <Icon name="file-excel" /> Exportar catálogo
          </Button>
          <Button
            className="btn"
            onClick={() => handleExportCatalog("print")}
            title="Imprimir el índice de reportes"
          >
            <Icon name="printer" /> Imprimir índice
          </Button>
        </div>
      </PageHeader>

      <SectionHeader
        as="h2"
        icon="file-chart"
        title="Catálogo de reportes"
        description="Biblioteca de reportes exportables en Excel, PDF, CSV o impresión."
        action={
          <span className="ws-section-meta" aria-live="polite">
            {visibles.length} disponibles
          </span>
        }
      />

      <div className="filter-bar mb">
        <label htmlFor="report-query" className="strong">
          Biblioteca de reportes
        </label>
        <Input icon={fieldIcon("query", "Biblioteca de reportes\n        ", "search")}
          id="report-query"
          className="inp"
          type="search"
          placeholder="Buscar por nombre o contenido…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted small" aria-live="polite">
          {visibles.length} disponibles
        </span>
      </div>

      <div className="resource-list">
        {visibles.map((r) => (
          <ResourceCard
            key={r.k}
            title={r.t}
            description={r.d}
            icon={r.ic}
            onOpen={() => abrirReporte(r.k)}
            actions={
              <>
                {(["xlsx", "pdf", "csv", "print"] as const).map((format) => (
                  <Button key={format} onClick={() => exportReporte(r, format)}>
                    {format === "print" ? "Imprimir" : format.toUpperCase()}
                  </Button>
                ))}
              </>
            }
          />
        ))}
        {visibles.length === 0 && (
          <EmptyState
            title="Ningún reporte coincide"
            description="Prueba otro término o limpia la búsqueda."
            action={
              <Button className="btn pri" onClick={() => setQuery("")}>
                Limpiar búsqueda
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};
