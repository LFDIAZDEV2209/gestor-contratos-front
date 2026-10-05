'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, AuthService } from '../../lib/store';
import { Icon } from '../../components/icons';
import type { User } from '../../lib/types';
import { BrandLogo } from '../../components/app/BrandLogo';

type FieldErrors = { email?: string; password?: string };

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (AuthService.isAuthed()) {
      router.replace('/dashboard');
      return;
    }
    Store.init();
    setUsers((Store.getDB()?.users || []).filter((u) => u.estado === 'Activo'));
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: FieldErrors = {};
    const mail = email.trim().toLowerCase();
    if (!mail) errs.email = 'Ingresa tu correo corporativo.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) errs.email = 'Formato de correo no válido.';
    if (!password) errs.password = 'Ingresa tu contraseña.';
    else if (password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres.';
    setErrors(errs);
    setBanner(null);
    if (Object.keys(errs).length > 0) return;

    const user = users.find((u) => (u.email || '').toLowerCase() === mail);
    setBusy(true);
    // Simulación de autenticación (fase 0, sin backend): 650 ms con estado de carga real
    timerRef.current = window.setTimeout(() => {
      setBusy(false);
      if (!user) {
        setBanner(
          'No encontramos una cuenta con ese correo. Selecciona un usuario demo o intenta con otro correo.'
        );
        return;
      }
      AuthService.signIn(user.id, remember);
      router.replace('/dashboard');
    }, 650);
  };

  const useDemo = (u: User) => {
    setEmail(u.email || '');
    setPassword('demo1234');
    setErrors({});
    setBanner(null);
  };

  return (
    <div className="login">
      {/* Panel del formulario */}
      <main className="login-panel" aria-label="Inicio de sesión Seven Safe">
        <div className="login-form-wrap">
          <div className="login-brand">
            <BrandLogo />
          </div>
          <div className="login-tag">Gestión integral de contratos</div>

          <h1 className="login-title">Bienvenido de nuevo</h1>
          <p className="login-sub">Ingresa con tu cuenta corporativa para continuar.</p>

          {banner && (
            <div className="login-banner" role="alert">
              <Icon name="circle-info" />
              <span>{banner}</span>
            </div>
          )}

          <form className="login-form" onSubmit={submit} noValidate>
            <div className={`field ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="login-email">Correo corporativo</label>
              <div className="login-input">
                <Icon name="user" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@empresa.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  autoFocus
                />
              </div>
              {errors.email && (
                <p className="login-err" id="login-email-error" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className={`field ${errors.password ? 'has-error' : ''}`}>
              <div className="login-label-row">
                <label htmlFor="login-pass">Contraseña</label>
                <button
                  type="button"
                  className="login-help-link"
                  onClick={() => setHelpOpen((v) => !v)}
                  aria-expanded={helpOpen}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="login-input">
                <Icon name="lock" />
                <input
                  id="login-pass"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-pass-error' : undefined}
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPass}
                >
                  <Icon name="eye" />
                </button>
              </div>
              {errors.password && (
                <p className="login-err" id="login-pass-error" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            {helpOpen && (
              <div className="login-help-note" role="note">
                <Icon name="circle-info" />
                <span>
                  En esta demo la recuperación de contraseña no está conectada a un servidor. Usa un
                  usuario demo y cualquier contraseña de 6 o más caracteres.
                </span>
              </div>
            )}

            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Mantener la sesión abierta en este equipo</span>
            </label>

            <button type="submit" className="btn pri login-submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Verificando credenciales…
                </>
              ) : (
                <>Iniciar sesión</>
              )}
            </button>
          </form>

          {users.length > 0 && (
            <details className="login-demo">
              <summary>Acceso rápido (demo) <Icon name="chevron-down" /></summary>
              <p className="login-demo-note">Selecciona una cuenta para completar el formulario.</p>
              <div className="login-demo-chips">
                {users.slice(0, 6).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="login-chip"
                    onClick={() => useDemo(u)}
                    title={`Llenar formulario con ${u.nombre}`}
                  >
                    <span className="login-chip-ava" aria-hidden="true">
                      {(u.nombre || 'U')
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span className="login-chip-txt">
                      <span className="n">{u.nombre}</span>
                      <span className="r">{u.rol}</span>
                    </span>
                  </button>
                ))}
              </div>
            </details>
          )}

          <footer className="login-foot">
            <span>Seven Safe</span>
            <span aria-hidden="true">·</span>
            <span>FYA TECH SAS</span>
          </footer>
        </div>
      </main>

      {/* Panel visual con identidad Seven Safe */}
      <aside className="login-media" aria-hidden="true">
        <svg className="login-waves" viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id="login-wave-front" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#5CA6B2" />
              <stop offset="1" stopColor="#286885" />
            </linearGradient>
            <linearGradient id="login-wave-back" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#397889" />
              <stop offset="1" stopColor="#5CA6B2" />
            </linearGradient>
          </defs>
          <path d="M0 800 C280 860 400 770 610 700 S860 660 1000 440 L1000 1000 H0Z" fill="url(#login-wave-back)" opacity=".22" />
          <path d="M0 870 C250 920 460 870 630 740 S890 690 1000 600 L1000 1000 H0Z" fill="url(#login-wave-back)" opacity=".5" />
          <path d="M0 950 C290 1000 380 910 610 855 S850 690 1000 750 L1000 1000 H0Z" fill="url(#login-wave-front)" />
          <path d="M0 800 C280 860 400 770 610 700 S860 660 1000 440" fill="none" stroke="#BCE3EA" strokeOpacity=".3" />
          <path className="login-wave-seam" d="M0 0 H65 C-30 220 145 490 65 740 S40 900 0 1000Z" fill="#FFFFFF" />
        </svg>
        <div className="login-media-content">
          <div className="login-media-head">
            <BrandLogo inverse />
            <span className="login-media-badge">Suite contractual</span>
          </div>
          <div className="login-media-copy">
            <h2>
              Cada contrato, <b>bajo control.</b>
            </h2>
            <p>Contratos, garantías y trazabilidad en un solo lugar. Más claridad para cada decisión.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
