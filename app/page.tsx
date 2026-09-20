'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key,
  ShieldCheck,
  Server,
  Users,
  Activity,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Globe,
  Trash2,
  Clock,
  Code2,
  CheckCircle2,
  Eye,
  Sliders,
  LogOut,
} from 'lucide-react';
import type { License, Reseller, AuditLog } from '@/lib/db';

export default function LicenseServerDashboard() {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState('admin@scanfix.dev');
  const [activeTab, setActiveTab] = useState<'licenses' | 'resellers' | 'logs' | 'docs'>('licenses');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [publicKey, setPublicKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [showCreateLicense, setShowCreateLicense] = useState(false);
  const [showCreateReseller, setShowCreateReseller] = useState(false);
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);

  // Form states for license creation
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [tier, setTier] = useState<'solo' | 'pro' | 'agency' | 'enterprise'>('agency');
  const [allowedDomains, setAllowedDomains] = useState('*');
  const [maxDomains, setMaxDomains] = useState(1);
  const [durationDays, setDurationDays] = useState<string>('365'); // 365, 30, or lifetime
  const [selectedResellerId, setSelectedResellerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLicense, setCreatedLicense] = useState<License | null>(null);

  // Form state for reseller creation
  const [resellerName, setResellerName] = useState('');
  const [resellerEmail, setResellerEmail] = useState('');
  const [resellerQuota, setResellerQuota] = useState(25);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [licRes, resRes, logRes, keyRes, meRes] = await Promise.all([
        fetch('/api/v1/admin/licenses'),
        fetch('/api/v1/admin/resellers'),
        fetch('/api/v1/admin/logs'),
        fetch('/api/v1/license/public-key'),
        fetch('/api/v1/admin/me'),
      ]);

      if (licRes.status === 401 || meRes.status === 401) {
        router.push('/login');
        return;
      }

      if (meRes.ok) {
        const me = await meRes.json();
        if (me.email) setAdminEmail(me.email);
      }
      if (licRes.ok) {
        const d = await licRes.json();
        setLicenses(d.licenses || []);
      }
      if (resRes.ok) {
        const d = await resRes.json();
        setResellers(d.resellers || []);
      }
      if (logRes.ok) {
        const d = await logRes.json();
        setLogs(d.logs || []);
      }
      if (keyRes.ok) {
        const d = await keyRes.json();
        setPublicKey(d.publicKey || '');
      }
    } catch (err) {
      console.error('Failed to load license server data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/v1/admin/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const domainsArr = allowedDomains
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/v1/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail,
          tier,
          allowedDomains: domainsArr.length > 0 ? domainsArr : ['*'],
          maxDomains: Number(maxDomains),
          durationDays: durationDays === 'lifetime' ? null : Number(durationDays),
          resellerId: selectedResellerId || null,
          notes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.license) {
        setCreatedLicense(json.license);
        fetchData();
      } else {
        alert(json.error || 'Failed to create license');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating license');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/admin/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: resellerName,
          email: resellerEmail,
          quotaLimit: Number(resellerQuota),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowCreateReseller(false);
        setResellerName('');
        setResellerEmail('');
        fetchData();
      } else {
        alert(json.error || 'Failed to create reseller');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating reseller');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (license: License, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/admin/licenses/${license.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleRenew = async (license: License, daysToAdd: number = 30) => {
    try {
      const res = await fetch(`/api/v1/admin/licenses/${license.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDaysToAdd: daysToAdd }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error renewing:', err);
    }
  };

  const handleDelete = async (license: License) => {
    if (!confirm(`Are you sure you want to permanently delete license ${license.key}?`)) return;
    try {
      const res = await fetch(`/api/v1/admin/licenses/${license.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error deleting license:', err);
    }
  };

  // Metrics
  const totalActive = licenses.filter((l) => l.status === 'active').length;
  const totalActivations = licenses.reduce((acc, l) => acc + l.activatedDomains.length, 0);
  const totalSuspendedRevoked = licenses.filter(
    (l) => l.status === 'suspended' || l.status === 'revoked'
  ).length;

  const filteredLicenses = licenses.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.key.toLowerCase().includes(q) ||
      l.customerEmail.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q) ||
      l.tier.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-grid p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                  <span>ScanFix License Server</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                    Ed25519 Authority
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">
                  Cryptographic license issuance, domain binding, remote kill-switch & reseller management.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowPublicKeyModal(true)}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Key className="h-3.5 w-3.5 text-zinc-400" />
              <span>Public Key</span>
            </button>

            <button
              onClick={fetchData}
              className="p-2 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowCreateReseller(true)}
              className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Users className="h-3.5 w-3.5 text-purple-400" />
              <span>New Reseller</span>
            </button>

            <button
              onClick={() => {
                setCreatedLicense(null);
                setShowCreateLicense(true);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/10 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Issue License Key</span>
            </button>

            <div className="h-5 w-px bg-zinc-800 mx-1" />

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title={`Logged in as ${adminEmail}`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4 Hero Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Total Licenses
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-white">{licenses.length}</span>
              <span className="text-xs text-emerald-400">{totalActive} active</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Active Domains
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-emerald-400">{totalActivations}</span>
              <span className="text-xs text-zinc-500">bound instances</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Revoked / Suspended
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-amber-400">{totalSuspendedRevoked}</span>
              <span className="text-xs text-zinc-500">instances blocked</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Reseller Partners
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-purple-400">{resellers.length}</span>
              <span className="text-xs text-zinc-500">quota managers</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('licenses')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'licenses'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Key className="h-4 w-4" />
              <span>Licenses ({licenses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('resellers')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'resellers'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Resellers ({resellers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'logs'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Telemetry & Heartbeats ({logs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'docs'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="h-4 w-4" />
              <span>Integration Guide</span>
            </button>
          </div>

          {activeTab === 'licenses' && (
            <div className="pb-2">
              <input
                type="text"
                placeholder="Search licenses, emails, domains..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-64"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Licenses Table */}
        {activeTab === 'licenses' && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-950/80 border-b border-zinc-800/80 text-[11px] uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">License Key</th>
                    <th className="py-3.5 px-4 font-semibold">Customer / Email</th>
                    <th className="py-3.5 px-4 font-semibold">Tier</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Bound Domains</th>
                    <th className="py-3.5 px-4 font-semibold">Expires</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-mono text-xs">
                        No licenses match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredLicenses.map((lic) => {
                      const isExpired = lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now();
                      const statusColor =
                        lic.status === 'revoked'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : lic.status === 'suspended'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : isExpired
                          ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                      return (
                        <tr key={lic.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-white tracking-wider">
                                {lic.key}
                              </span>
                              <button
                                onClick={() => handleCopy(lic.key, lic.id)}
                                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                title="Copy Key"
                              >
                                {copiedKey === lic.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div>
                              <div className="font-medium text-zinc-200">{lic.customerName}</div>
                              <div className="text-[11px] text-zinc-500 font-mono">{lic.customerEmail}</div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300">
                              {lic.tier}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${statusColor}`}>
                              {isExpired ? 'EXPIRED' : lic.status.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            {lic.activatedDomains.length > 0 ? (
                              <div className="space-y-1">
                                {lic.activatedDomains.map((d, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-zinc-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    <span>{d.domain}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-500">Unused (Allowed: {lic.allowedDomains.join(', ')})</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs">
                            {lic.expiresAt ? (
                              <span className={isExpired ? 'text-rose-400' : 'text-zinc-300'}>
                                {new Date(lic.expiresAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">Lifetime</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {lic.status === 'active' ? (
                                <button
                                  onClick={() => handleToggleStatus(lic, 'suspended')}
                                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 text-[10px] font-mono border border-zinc-700 transition-colors"
                                  title="Temporarily suspend"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(lic, 'active')}
                                  className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-mono border border-emerald-500/30 transition-colors"
                                  title="Reactivate"
                                >
                                  Activate
                                </button>
                              )}

                              {lic.status !== 'revoked' && (
                                <button
                                  onClick={() => handleToggleStatus(lic, 'revoked')}
                                  className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-mono border border-rose-500/30 transition-colors"
                                  title="Remote Kill Switch"
                                >
                                  Revoke
                                </button>
                              )}

                              <button
                                onClick={() => handleRenew(lic, 30)}
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono border border-zinc-700 transition-colors"
                                title="Add 30 days"
                              >
                                +30d
                              </button>

                              <button
                                onClick={() => handleDelete(lic)}
                                className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                                title="Delete License"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Resellers */}
        {activeTab === 'resellers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {resellers.map((r) => {
                const pct = Math.round((r.quotaUsed / r.quotaLimit) * 100);
                return (
                  <div
                    key={r.id}
                    className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-bold text-white">{r.name}</h4>
                        <p className="text-xs text-zinc-400 font-mono">{r.email}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Reseller
                      </span>
                    </div>

                    <div className="space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>Quota Used:</span>
                        <span className="font-bold text-white">
                          {r.quotaUsed} / {r.quotaLimit} keys ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 flex items-center justify-between">
                      <span className="truncate mr-2">API Key: {r.apiKey}</span>
                      <button
                        onClick={() => handleCopy(r.apiKey, r.id)}
                        className="text-zinc-500 hover:text-zinc-300 shrink-0"
                      >
                        {copiedKey === r.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Telemetry & Logs */}
        {activeTab === 'logs' && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-950/80 border-b border-zinc-800/80 text-[11px] uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">License Key</th>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30">
                      <td className="py-3 px-4 text-zinc-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 uppercase text-zinc-300 font-semibold">{log.action}</td>
                      <td className="py-3 px-4 text-white font-mono">{log.licenseKey || '—'}</td>
                      <td className="py-3 px-4 text-emerald-400">{log.domain || '—'}</td>
                      <td className="py-3 px-4 text-zinc-400">{log.ip || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            log.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 font-sans text-xs">{log.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Integration Docs */}
        {activeTab === 'docs' && (
          <div className="space-y-6 max-w-4xl text-sm">
            <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                <span>How ScanFix Connects to this License Server</span>
              </h3>
              <p className="text-zinc-300 leading-relaxed text-xs">
                To connect any deployed ScanFix instance to this License Server, the buyer or reseller sets these two environment variables:
              </p>

              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-emerald-400">
                <pre>{`# .env.local on the ScanFix instance
LICENSE_SERVER_URL=http://localhost:4000
LICENSE_KEY=SF-XXXX-XXXX-XXXX-XXXX`}</pre>
              </div>

              <h4 className="text-sm font-semibold text-white pt-2">Verification Flow:</h4>
              <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-400">
                <li>
                  <strong className="text-zinc-200">First Launch (/setup):</strong> ScanFix makes a <code>POST /api/v1/license/activate</code> request to bind the buyer&apos;s domain.
                </li>
                <li>
                  <strong className="text-zinc-200">Cryptographic Signing:</strong> The License Server returns an Ed25519 digitally signed token verifying the domain and plan tier.
                </li>
                <li>
                  <strong className="text-zinc-200">Heartbeat Check (/verify):</strong> ScanFix sends a periodic check-in. If you click <em>Revoke</em> or <em>Suspend</em>, ScanFix immediately locks the instance.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Modal: Create License Key */}
        {showCreateLicense && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-400" />
                  <span>Generate New License</span>
                </h3>
                <button onClick={() => setShowCreateLicense(false)} className="text-zinc-500 hover:text-white">
                  ✕
                </button>
              </div>

              {createdLicense ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>License key created and ready for distribution!</span>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 font-mono text-xs">
                    <span className="text-zinc-500 block">License Key:</span>
                    <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded border border-zinc-800 text-white font-bold text-sm">
                      <span>{createdLicense.key}</span>
                      <button
                        onClick={() => handleCopy(createdLicense.key, 'created')}
                        className="text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'created' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowCreateLicense(false);
                      setCreatedLicense(null);
                    }}
                    className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateLicense} className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1">Customer Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Acme Agency LLC"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Customer Email</label>
                    <input
                      type="email"
                      required
                      placeholder="client@acme.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 block mb-1">Plan Tier</label>
                      <select
                        value={tier}
                        onChange={(e: any) => setTier(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                      >
                        <option value="solo">Solo ($49/mo)</option>
                        <option value="pro">Pro ($99/mo)</option>
                        <option value="agency">Agency ($249/mo)</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-zinc-400 block mb-1">Duration</label>
                      <select
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                      >
                        <option value="30">30 Days</option>
                        <option value="365">1 Year</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Allowed Domains (comma-separated, * for any)</label>
                    <input
                      type="text"
                      placeholder="client.com, *.client.com"
                      value={allowedDomains}
                      onChange={(e) => setAllowedDomains(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                    />
                  </div>

                  {resellers.length > 0 && (
                    <div>
                      <label className="text-zinc-400 block mb-1">Assign to Reseller (optional)</label>
                      <select
                        value={selectedResellerId}
                        onChange={(e) => setSelectedResellerId(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                      >
                        <option value="">Direct Sale (Master Admin)</option>
                        {resellers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} (Quota: {r.quotaUsed}/{r.quotaLimit})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                      <span>Generate & Issue Key</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal: Add Reseller */}
        {showCreateReseller && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  <span>Onboard New Reseller</span>
                </h3>
                <button onClick={() => setShowCreateReseller(false)} className="text-zinc-500 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateReseller} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Partner / Reseller Name</label>
                  <input
                    type="text"
                    required
                    placeholder="SaaS Launchpad Agency"
                    value={resellerName}
                    onChange={(e) => setResellerName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Partner Email</label>
                  <input
                    type="email"
                    required
                    placeholder="partner@agency.com"
                    value={resellerEmail}
                    onChange={(e) => setResellerEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">License Quota (Allowed Keys)</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={resellerQuota}
                    onChange={(e) => setResellerQuota(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors"
                  >
                    Create Reseller Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Public Key */}
        {showPublicKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-400" />
                  <span>Authority Ed25519 Public Key</span>
                </h3>
                <button onClick={() => setShowPublicKeyModal(false)} className="text-zinc-500 hover:text-white">
                  ✕
                </button>
              </div>

              <p className="text-xs text-zinc-400">
                This public key verifies digital signatures issued by this server. It can be shared publicly or embedded into ScanFix instances for offline verification.
              </p>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300 break-all overflow-x-auto">
                <pre>{publicKey}</pre>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleCopy(publicKey, 'pubkey')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {copiedKey === 'pubkey' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy Public Key</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
