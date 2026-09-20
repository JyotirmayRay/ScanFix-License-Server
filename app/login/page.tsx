'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';

interface BrandingInfo {
  companyName: string;
  serverName: string;
  logoUrl?: string;
  brandColor: string;
  footerText?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@scanfix.dev');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);

  useEffect(() => {
    fetch('/api/v1/admin/branding')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.branding) {
          setBranding(data.branding);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed.');
      }

      // Successfully logged in
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or secret key.');
    } finally {
      setLoading(false);
    }
  };

  const companyName = branding?.companyName || 'ScanFix';
  const serverName = branding?.serverName || 'License Authority';
  const footerText = branding?.footerText || 'Protected by Cryptographic Token Authority';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b] relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-2xl shadow-emerald-500/10 mb-3">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={companyName} className="h-8 w-8 object-contain rounded-lg" />
            ) : (
              <Shield className="h-8 w-8 text-emerald-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>{companyName} {serverName}</span>
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Restricted administrative control plane for cryptographic license generation, domain locks, and reseller quotas.
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="border-b border-zinc-800/60 pb-4">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Operator Authentication</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Enter your admin credentials or master API key to access this server.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                <span>Admin Email</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourdomain.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
              />
            </div>

            {/* Password / Master Key Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Admin Password / Master Key</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">ADMIN_API_KEY</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Control Plane</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="pt-2 border-t border-zinc-800/40 text-center">
            <p className="text-[11px] text-zinc-500 font-mono">
              {footerText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
