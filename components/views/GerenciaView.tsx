"use client";
import { Button } from "../ui/button";
import { PageHeader, Surface, EmptyState } from "../ui/Workspace";
import { SectionHeader } from "../ui/SectionHeader";
import type {
  Contract,
  Guarantee,
  Breach,
  Obligation,
  Exec,
  Payment,
} from "../../lib/types";
import { Store } from "../../lib/store";
import { M, portfolio, companyName } from "../../lib/metrics";
import { LEVEL, LEVEL_TXT } from "../../lib/catalog";
import {
  fdate,
  money,
  moneyM,
  pct,
  sum,
  diffDays,
  todayIso,
  monthKey,
  monthLabel,
  lastMonths,
  groupBy,
} from "../../lib/format";
import { exportRows } from "../../lib/export";
import { Chart } from "../ui/Chart";
import { Icon } from "../icons";

// Conserva la unidad monetaria completa cuando la franja necesita dos líneas.
const nb = (value: string) => value.replace("mil M", "mil\u00A0M");

export const GerenciaView = ({
  onSelectContract,
}: {
  onSelectContract: (cid: string) => void;
}) => {
  const P = portfolio();
  const allObligations = Store.all("obligations") as Obligation[];

  // Abreviatura monetaria para ejes de gráficas (coherente con moneyM de lib/format)
  const moneyShort = (v: unknown): string => {
    const n =
      typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
    if (!isFinite(n) || n === 0) return "0";
    const abs = Math.abs(n);
    const f = (x: number, d: number) =>
      x.toLocaleString("es-CO", { maximumFractionDigits: d });
    if (abs >= 1e12) return `${f(n / 1e12, 1)} B`;
    if (abs >= 1e9) return `${f(n / 1e9, 1)} mil M`;
    if (abs >= 1e6) return `${f(n / 1e6, 0)} M`;
    if (abs >= 1e3) return `${f(n / 1e3, 0)} k`;
    return f(n, 0);
  };
  const allGuarantees = (Store.all("guarantees") as Guarantee[]).filter(
    (g) => g.estado === "Aprobada",
  );
  const allBreaches = (Store.all("breaches") as Breach[]).filter(
    (b) => b.estado !== "Cerrado" && b.estado !== "Subsanado",
  );

  const riesgo = P.n
    ? (P.byLevel.crit * 100 + P.byLevel.risk * 60 + P.byLevel.warn * 25) / P.n
    : 0;
  const avgObl = allObligations.length
    ? sum(allObligations, (o) => Number(o.cumplimiento || 0)) /
      allObligations.length
    : 0;

  // Contratos que requieren una decisión gerencial
  const criticalContracts = P.cs
    .filter((c) => {
      const m = M(c);
      return LEVEL[m.nivel] >= 3; // Crítico o en riesgo
    })
    .sort((a, b) => {
      const ma = M(a);
      const mb = M(b);
      return (
        LEVEL[mb.nivel] - LEVEL[ma.nivel] || mb.valorActual - ma.valorActual
      );
    });

  // Gráfica 1: evolución mensual acumulada (12 meses)
  const mk = lastMonths(12);
  const execsByPeriod = groupBy(Store.all("execs") as Exec[], (e) => e.periodo);
  const paymentsByPeriod = groupBy(
    (Store.all("payments") as Payment[]).filter((p) => p.estado === "Pagado"),
    (p) => monthKey(p.fechaPago || p.fecha),
  );

  let accExec = 0;
  let accPay = 0;
  const dataExecAcc = mk.map((k) => {
    accExec += sum(execsByPeriod[k] || [], (e) => Number(e.valor) || 0);
    return accExec;
  });
  const dataPayAcc = mk.map((k) => {
    accPay += sum(
      paymentsByPeriod[k] || [],
      (p) => (Number(p.bruto) || 0) + (Number(p.iva) || 0),
    );
    return accPay;
  });

  const evoChartData = {
    labels: mk.map(monthLabel),
    datasets: [
      {
        label: "Ejecutado acumulado",
        data: dataExecAcc,
        borderColor: "#062F58",
        backgroundColor: "rgba(6, 47, 88,0.12)",
        fill: true,
        tension: 0.25,
      },
      {
        label: "Pagado acumulado",
        data: dataPayAcc,
        borderColor: "#2F6FA3",
        tension: 0.25,
      },
    ],
  };
  // La evolución solo se grafica si hubo ejecutado o pagos en el período
  const evoHayDatos =
    dataExecAcc.some((v) => v > 0) || dataPayAcc.some((v) => v > 0);

  // Gráfica 2: estado de las garantías
  const now = todayIso();
  const gVigentes = allGuarantees.filter(
    (g) => diffDays(now, g.fechaVenc) > 30,
  ).length;
  const gPorVencer = allGuarantees.filter((g) => {
    const d = diffDays(now, g.fechaVenc);
    return d >= 0 && d <= 30;
  }).length;
  const gVencidas = allGuarantees.filter(
    (g) => diffDays(now, g.fechaVenc) < 0,
  ).length;

  const garChartData = {
    labels: ["Vigentes > 30 d", "≤ 30 días", "Vencidas"],
    datasets: [
      {
        data: [gVigentes, gPorVencer, gVencidas],
        backgroundColor: ["#062F58", "#B98B00", "#BE3A2E"],
      },
    ],
  };

  // Gráfica 3: valor por empresa
  const byCompany = groupBy(P.cs, (c) => c.companyId);
  const companyKeys = Object.keys(byCompany);
  const companyLabels = companyKeys.map((k) => {
    const n = companyName(k);
    return n.length > 24 ? n.slice(0, 24) + "…" : n;
  });
  const companyValAct = companyKeys.map((k) =>
    sum(byCompany[k], (c) => M(c).valorActual),
  );
  const companyEjec = companyKeys.map((k) =>
    sum(byCompany[k], (c) => M(c).ejecutado),
  );

  const empChartData = {
    labels: companyLabels,
    datasets: [
      {
        label: "Valor actualizado",
        data: companyValAct,
        backgroundColor: "rgba(6, 47, 88, 0.30)",
        borderRadius: 3,
      },
      {
        label: "Ejecutado",
        data: companyEjec,
        backgroundColor: "#062F58",
        borderRadius: 3,
      },
    ],
  };

  const handleExport = (format: "xlsx" | "pdf" | "csv") => {
    // Si no hay contratos críticos se exporta el portafolio completo (acción útil)
    const rows = criticalContracts.length ? criticalContracts : P.cs;
    const title = criticalContracts.length
      ? "Control Gerencial - Contratos Críticos"
      : "Control Gerencial - Portafolio Completo";
    const cols = [
      { l: "Contrato", k: "numero" },
      { l: "Empresa", k: "companyId", r: (c: any) => companyName(c.companyId) },
      { l: "Contratista", k: "contratista" },
      { l: "Valor Actual", k: "val", r: (c: any) => money(M(c).valorActual) },
      { l: "Semáforo", k: "sem", r: (c: any) => LEVEL_TXT[M(c).nivel] },
      {
        l: "Razón principal",
        k: "razon",
        r: (c: any) =>
          M(c)
            .razones.map((r) => r.t)
            .join("; "),
      },
    ];
    exportRows(title, cols, rows, format);
  };

  return (
    <div className="motion-safe:[&_.btn]:hover:-translate-y-0.5 [&_.btn]:hover:shadow-[var(--shadow-2)]! [&_.btn]:focus-visible:shadow-[var(--shadow-2)]! motion-safe:[&_.btn]:[transition:translate_var(--t-fast)_var(--ease),box-shadow_var(--t-fast)_var(--ease),background-color_var(--t-fast)_var(--ease)]! motion-safe:[&_a]:hover:-translate-y-0.5 [&_a]:hover:shadow-[var(--shadow-1)]">
      {/* Conmutación botones directos (≥1024px) ↔ desplegable Exportar (<1024px),
          mismo patrón de agenda; el hero recorta menús absolutos, por eso el
          desplegable se expande en flujo y no usa .action-disclosure-content. */}
      <style>
        {`
          @media (min-width: 1024px) { .grx-dd { display: none !important; } }
          @media (max-width: 1023.98px) { .grx-inline { display: none !important; } }
          .grx-chev { transition: transform var(--t-fast, 160ms) var(--ease, ease); }
          .grx-dd[open] .grx-chev { transform: rotate(180deg); }
        `}
      </style>
      {/* Cabecera gerencial con feedback de foco y elevación en acciones. */}
      <PageHeader variant="hero" className="page-h anim-fade-rise">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "inline-grid",
                placeItems: "center",
                background: "rgba(255, 255, 255, 0.16)",
                backdropFilter: "blur(6px)",
                flexShrink: 0,
              }}
            >
              <Icon
                name="briefcase"
                size={22}
                style={{ color: "var(--color-primary-foreground, white)" }}
              />
            </span>
            <div>
              <h1 style={{ margin: 0 }}>Control gerencial de contratos</h1>
              <p style={{ margin: "4px 0 0" }}>
                Vista estratégica del portafolio contractual para la alta
                dirección al {fdate(todayIso())}.
              </p>
            </div>
          </div>
        </div>
        <div
          className="ph-actions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {/* ≥1024px: accesos directos, como en el resto del sistema */}
          <div
            className="grx-inline"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Button
              className="btn sm"
              onClick={() => handleExport("xlsx")}
              title="Exportar a Excel"
            >
              <Icon name="file-excel" /> Excel
            </Button>
            <Button
              className="btn sm"
              onClick={() => handleExport("pdf")}
              title="Exportar a PDF"
            >
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button
              className="btn sm"
              onClick={() => handleExport("csv")}
              title="Exportar a CSV"
            >
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          {/* <1024px: un solo botón desplegable; se expande en flujo dentro del hero */}
          <details className="grx-dd">
            <summary
              className="btn sm"
              title="Exportar control gerencial"
              aria-label="Exportar control gerencial"
              style={{ listStyle: "none" }}
            >
              <Icon name="download" /> Exportar{" "}
              <Icon name="chevron-down" size={14} className="grx-chev" />
            </summary>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 8,
                padding: 8,
                border: "1px solid rgba(255, 255, 255, 0.28)",
                borderRadius: "var(--r, 12px)",
                background: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <Button
                className="btn sm"
                onClick={() => handleExport("xlsx")}
                title="Exportar a Excel"
              >
                <Icon name="file-excel" /> Excel
              </Button>
              <Button
                className="btn sm"
                onClick={() => handleExport("pdf")}
                title="Exportar a PDF"
              >
                <Icon name="file-pdf" /> PDF
              </Button>
              <Button
                className="btn sm"
                onClick={() => handleExport("csv")}
                title="Exportar a CSV"
              >
                <Icon name="file-csv" /> CSV
              </Button>
            </div>
          </details>
        </div>
      </PageHeader>

      {/* Ocho indicadores ejecutivos; cifras Geist tabulares del sistema vigente. */}
      <div className="bigstrip mb [&_.v]:[font-family:var(--font-fig,var(--font-sans))]! [&_.v]:tabular-nums [&_.v]:text-balance [&>div]:hover:bg-[var(--side-active)] motion-safe:[&>div]:hover:-translate-y-0.5">
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "0ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="folder" size={13} style={{ color: "var(--brand-3)" }} />
            <span>Total contratos</span>
          </div>
          <div className="v">{P.n}</div>
          <div className="s">{P.act} activos</div>
        </div>
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "40ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon
              name="dollar-sign"
              size={13}
              style={{ color: "var(--brand-3)" }}
            />
            <span>Valor administrado</span>
          </div>
          <div className="v">{nb(moneyM(P.valor))}</div>
          <div className="s">Valor actualizado</div>
        </div>
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "80ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="wallet" size={13} style={{ color: "var(--brand-3)" }} />
            <span>Valor ejecutado</span>
          </div>
          <div className="v">{nb(moneyM(P.ejec))}</div>
          <div className="s">{pct(P.pctFin)} del total</div>
        </div>
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "120ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon
              name="chart-pie"
              size={13}
              style={{ color: "var(--brand-3)" }}
            />
            <span>Saldo disponible</span>
          </div>
          <div className="v">{nb(moneyM(P.saldo))}</div>
          <div className="s">Por ejecutar</div>
        </div>
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "160ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon
              name="shield-alert"
              size={13}
              style={{ color: "var(--risk)" }}
            />
            <span>Riesgo contractual</span>
          </div>
          <div className="v">
            {Math.round(riesgo)}
            <span style={{ fontSize: "13px", fontWeight: 400 }}>/100</span>
          </div>
          {/* El degradado se anima una sola vez; reduced-motion lo desactiva globalmente. */}
          <div
            role="meter"
            aria-label="Riesgo contractual"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(riesgo)}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--side-line)]"
          >
            <div
              style={{
                height: "100%",
                width: `${riesgo}%`,
                borderRadius: "inherit",
                background:
                  "linear-gradient(90deg, var(--ok), var(--warn), var(--risk), var(--crit))",
                backgroundSize: "200% 100%",
                animation: "shimmer calc(var(--t-slow) * 3) var(--ease) both",
              }}
            />
          </div>
          <div className="s">
            {P.byLevel.crit} críticos · {P.byLevel.risk} en riesgo
          </div>
        </div>
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "200ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="clock" size={13} style={{ color: "var(--warn)" }} />
            <span>Vencimientos&nbsp;≤&nbsp;30&nbsp;d</span>
          </div>
          <div className="v">{P.prox}</div>
          <div className="s">{P.venc} vencidos</div>
        </div>
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "240ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon
              name="alert-triangle"
              size={13}
              style={{ color: "var(--crit)" }}
            />
            <span>Incumplimientos</span>
          </div>
          <div className="v">{allBreaches.length}</div>
          <div className="s">Abiertos</div>
        </div>
        <div
          className="anim-fade-rise"
          style={{
            animationDelay: "280ms",
            transition:
              "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
          }}
        >
          <div
            className="l"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon
              name="clipboard-check"
              size={13}
              style={{ color: "var(--ok)" }}
            />
            <span>Obligaciones</span>
          </div>
          <div className="v">{pct(avgObl, 0)}</div>
          <div className="s">Cumplimiento promedio</div>
        </div>
      </div>

      {/* Evolución financiera y estado de garantías. */}
      <div className="grid g-21 mb">
        <Surface
          className="panel anim-fade-rise"
          style={{ animationDelay: "80ms" }}
        >
          <SectionHeader
            as="h3"
            icon="trending-up"
            title="Evolución mensual"
            description="Ejecución y pagos acumulados (últimos 12 meses)"
          />
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: "260px" }}>
              {evoHayDatos ? (
                <Chart
                  type="line"
                  data={evoChartData}
                  options={{
                    scales: {
                      y: {
                        ticks: {
                          callback: (v: string | number) => moneyShort(v),
                        },
                      },
                    },
                  }}
                />
              ) : (
                <EmptyState
                  title="Sin ejecución registrada"
                  description="La evolución acumulada de ejecutado y pagado se dibujará al registrar movimientos."
                />
              )}
            </div>
          </div>
        </Surface>

        <Surface
          className="panel anim-fade-rise"
          style={{ animationDelay: "120ms" }}
        >
          <SectionHeader
            as="h3"
            icon="shield"
            title="Garantías"
            description={`${allGuarantees.length} pólizas aprobadas`}
          />
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: "260px" }}>
              {allGuarantees.length > 0 ? (
                <Chart
                  type="doughnut"
                  data={garChartData}
                  options={{ cutout: "65%" }}
                />
              ) : (
                <EmptyState
                  title="Sin garantías aprobadas"
                  description="El estado de las pólizas (vigentes, por vencer y vencidas) aparecerá al aprobar garantías."
                />
              )}
            </div>
          </div>
        </Surface>
      </div>

      {/* Distribución por empresa y decisiones pendientes. */}
      <div className="grid g2 mb">
        <Surface
          className="panel anim-fade-rise"
          style={{ animationDelay: "160ms" }}
        >
          <SectionHeader
            as="h3"
            icon="building"
            title="Valor por empresa"
            description="Distribución del portafolio contratado"
          />
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: "280px" }}>
              {companyKeys.length > 0 ? (
                <Chart
                  type="bar"
                  data={empChartData}
                  options={{
                    indexAxis: "y" as const,
                    scales: {
                      x: { ticks: { callback: (val: any) => moneyShort(val) } },
                    },
                  }}
                />
              ) : (
                <EmptyState
                  title="Sin contratos por empresa"
                  description="Asocia contratos a empresas para ver la distribución del valor contratado y ejecutado."
                />
              )}
            </div>
          </div>
        </Surface>

        <Surface
          className="panel anim-fade-rise"
          style={{ animationDelay: "200ms" }}
        >
          <SectionHeader
            as="h3"
            icon="alert-triangle"
            title="Contratos que requieren decisión"
            description={`Nivel crítico o de riesgo (${criticalContracts.length})`}
          />
          <div
            className="panel-b np"
            style={{ maxHeight: "310px", overflowY: "auto" }}
          >
            {criticalContracts.map((c, idx) => {
              const m = M(c);
              const reason =
                m.razones
                  .filter((r) => r.l === m.nivel)
                  .map((r) => r.t)
                  .join(" ") || "Requiere atención inmediata";
              return (
                <button
                  type="button"
                  key={c.id}
                  className="todo anim-fade-rise w-full text-left hover:shadow-[var(--shadow-2)] focus-visible:shadow-[var(--shadow-2)] motion-safe:hover:-translate-y-0.5"
                  onClick={() => onSelectContract(c.id)}
                  style={{
                    cursor: "pointer",
                    animationDelay: `${idx * 40}ms`,
                    transition:
                      "translate var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)",
                  }}
                >
                  <span
                    className={`sem ${m.sem}`}
                    style={{ marginTop: "2px" }}
                  ></span>
                  <span className="x">
                    <b>{c.numero}</b> · {companyName(c.companyId)}
                    <span
                      className="small muted block"
                      style={{ marginTop: "2px" }}
                    >
                      {reason}
                    </span>
                  </span>
                  <span className="small strong">{moneyM(m.valorActual)}</span>
                  <Icon name="chevron-right" />
                </button>
              );
            })}
            {criticalContracts.length === 0 && (
              <div className="panel-b np">
                <EmptyState
                  title="Sin contratos críticos ni en riesgo"
                  description="Todo el portafolio está en niveles normales o de atención. Exporta el portafolio completo para el informe gerencial."
                  action={
                    <Button
                      className="btn sm pri"
                      onClick={() => handleExport("xlsx")}
                    >
                      <Icon name="file-excel" /> Exportar portafolio
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
};
