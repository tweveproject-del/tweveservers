'use client';

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { getRecaptchaToken, preloadRecaptcha } from '@/app/lib/recaptcha';

export default function LoginGateClient() {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const noop = () => {};
      try {
        window.console.log = noop;
        window.console.info = noop;
        window.console.debug = noop;
        window.console.warn = noop;
        window.console.error = noop;
        window.console.table = noop;
        window.console.dir = noop;
        window.console.trace = noop;
      } catch {
        // ignore immutable console
      }
    }
    preloadRecaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil > Date.now() || loading) return;

    setErrorMsg('');
    setLoading(true);

    try {
      const recaptchaToken = await getRecaptchaToken('login');
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim().toLowerCase(),
          password: passwordInput.trim(),
          recaptchaToken,
        }),
      });

      const rawText = await res.text();
      let data: { authenticated?: boolean } = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = {};
        }
      }

      if (!res.ok || !data.authenticated) {
        if (res.status === 429) {
          setLockedUntil(Date.now() + 60 * 60 * 1000);
          setErrorMsg('Access temporarily blocked.');
        } else {
          setErrorMsg('Verification failed.');
        }
        return;
      }

      window.location.replace('/');
    } catch {
      setErrorMsg('Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        backgroundColor: '#020617',
        backgroundImage:
          'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.14), transparent 55%), radial-gradient(circle at 85% 90%, rgba(56, 189, 248, 0.1), transparent 45%)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem 1rem',
      }}
    >
      <section
        className="fleet-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2rem 1.65rem',
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '3.25rem',
              height: '3.25rem',
              borderRadius: '1rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.22))',
              border: '1px solid rgba(16, 185, 129, 0.48)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.85rem',
              boxShadow: '0 0 24px rgba(16, 185, 129, 0.22)',
            }}
          >
            <Lock style={{ width: '1.45rem', height: '1.45rem', color: '#34d399' }} />
          </div>
          <h1 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
            Restricted Access
          </h1>
          <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.3rem', marginBottom: 0 }}>
            Sign in to continue
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="gate-email"
              style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#cbd5e1',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.4rem',
              }}
            >
              Email
            </label>
            <input
              id="gate-email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email address"
            />
          </div>

          <div>
            <label
              htmlFor="gate-password"
              style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#cbd5e1',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.4rem',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="gate-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff style={{ width: '1rem', height: '1rem' }} />
                ) : (
                  <Eye style={{ width: '1rem', height: '1rem' }} />
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(244, 63, 94, 0.14)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                color: '#fda4af',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || lockedUntil > Date.now()}
            className="btn-fleet-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
          >
            <Shield style={{ width: '1rem', height: '1rem' }} />
            <span>
              {lockedUntil > Date.now()
                ? 'Blocked'
                : loading
                  ? 'Verifying...'
                  : 'Sign In'}
            </span>
          </button>
        </form>
      </section>
    </main>
  );
}
