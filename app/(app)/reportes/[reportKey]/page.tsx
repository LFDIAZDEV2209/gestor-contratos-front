"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/lib/store";
import { EmptyState } from "@/components/ui/Workspace";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { getReporte } from "@/components/reportes/catalogo";
import { ReporteVista } from "@/components/reportes/ReporteVista";

/**
 * VISTA dedicada: reporte generado (reemplaza al modal de vista previa de
 * ReportesView). `reportKey` es la clave estable del catálogo (r_general…).
 */
export default function Page({
  params,
}: {
  params: Promise<{ reportKey: string }>;
}) {
  const { reportKey } = use(params);
  const router = useRouter();

  // Protección ante claves malformadas tecleadas en la barra de direcciones
  let key = reportKey;
  try {
    key = decodeURIComponent(reportKey);
  } catch {
    key = reportKey;
  }

  const report = getReporte(key);
  const volver = () => router.push("/reportes");

  if (!report) {
    return (
      <div
        className="anim-fade-rise"
        style={{ padding: "40px 20px", textAlign: "center" }}
      >
        <EmptyState
          title="Reporte no encontrado"
          description="La clave del reporte no existe en la biblioteca. Puede que el reporte haya sido retirado del catálogo."
          action={
            <Button
              className="btn pri"
              onClick={volver}
              style={{ marginTop: 12 }}
            >
              <Icon name="chevron-left" /> Volver a Reportes
            </Button>
          }
        />
      </div>
    );
  }

  // Permiso de auditoría del reporte de bitácora (se resuelve al entrar directo)
  if (report.k === "r_aud" && !AuthService.can("auditar")) {
    return (
      <div
        className="anim-fade-rise"
        style={{ padding: "40px 20px", textAlign: "center" }}
      >
        <EmptyState
          title="Acceso restringido"
          description="Tu rol no tiene permiso de auditoría para consultar la bitácora de cambios."
          action={
            <Button
              className="btn pri"
              onClick={volver}
              style={{ marginTop: 12 }}
            >
              <Icon name="chevron-left" /> Volver a Reportes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <ReporteVista key={key} report={report} onBack={volver} />
    </div>
  );
}
