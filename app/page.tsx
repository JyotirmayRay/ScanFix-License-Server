'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  ShieldCheck,
  Key,
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
  Search,
  Filter,
  ExternalLink,
  ChevronDown,
  Terminal,
  Server,
  Lock,
  Zap,
} from 'lucide-react';
import type { License, Reseller, AuditLog } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function LicenseServerDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState('admin@scanfix.dev');
  const [activeTab, setActiveTab] = useState<'licenses' | 'resellers' | 'logs' | 'docs'>('licenses');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [publicKey, setPublicKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
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
  const [maxDomains, setMaxDomains] = useState(5);
  const [durationDays, setDurationDays] = useState<string>('365');
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
      const [licRes, resRes, logRes, keyRes] = await Promise.all([
        fetch('/api/v1/admin/licenses'),
        fetch('/api/v1/admin/resellers'),
        fetch('/api/v1/admin/logs'),
        fetch('/api/v1/license/public-key'),
      ]);

      if (licRes.status === 401) {
        setIsAuthenticated(false);
        router.replace('/login');
        return;
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
    router.replace('/login');
    router.refresh();
  };

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const meRes = await fetch('/api/v1/admin/me');
        if (!meRes.ok) {
          setIsAuthenticated(false);
          router.replace('/login');
          return;
        }
        const me = await meRes.json();
        if (!me.authenticated) {
          setIsAuthenticated(false);
          router.replace('/login');
          return;
        }

        setIsAuthenticated(true);
        if (me.email) setAdminEmail(me.email);
        await fetchData();
      } catch {
        setIsAuthenticated(false);
        router.replace('/login');
      }
    };

    checkAuthAndLoad();
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
    const matchesSearch =
      !q ||
      l.key.toLowerCase().includes(q) ||
      l.customerEmail.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q) ||
      l.tier.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesTier = tierFilter === 'all' || l.tier === tierFilter;

    return matchesSearch && matchesStatus && matchesTier;
  });

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400 font-mono tracking-wide">Authenticating operator session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white font-mono">ScanFix</span>
              <span className="text-zinc-600">/</span>
              <span className="text-xs text-zinc-400 font-medium">License Authority</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Ed25519 Authority Active</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowPublicKeyModal(true)}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Key className="h-3.5 w-3.5 text-zinc-400" />
              <span>Public Key</span>
            </button>

            <button
              onClick={fetchData}
              className="p-2 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="h-4 w-px bg-zinc-800 mx-1" />

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
              <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center font-mono">
                {adminEmail.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs text-zinc-300 font-mono hidden md:inline">{adminEmail}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-red-500/30 bg-zinc-900/60 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">License Control Plane</h1>
            <p className="text-xs text-zinc-400">
              Manage cryptographic licenses, enforce domain binding quotas, and oversee reseller distributions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCreateReseller(true)}
              className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <span>Add Reseller</span>
            </button>

            <button
              onClick={() => {
                setCreatedLicense(null);
                setShowCreateLicense(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Issue License Key</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>Active Licenses</span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-white">{totalActive}</span>
              <span className="text-xs text-zinc-500 font-mono">/ {licenses.length} total</span>
            </div>
            <p className="text-[11px] text-zinc-500">Cryptographically signed & active</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>Bound Domains</span>
              <Globe className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-cyan-400">{totalActivations}</span>
              <span className="text-xs text-zinc-500 font-mono">instances</span>
            </div>
            <p className="text-[11px] text-zinc-500">Live verified customer instances</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>Blocked / Revoked</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-amber-400">{totalSuspendedRevoked}</span>
              <span className="text-xs text-zinc-500 font-mono">enforced</span>
            </div>
            <p className="text-[11px] text-zinc-500">Remote kill-switch active</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>Reseller Partners</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-purple-400">{resellers.length}</span>
              <span className="text-xs text-zinc-500 font-mono">partners</span>
            </div>
            <p className="text-[11px] text-zinc-500">Managing distribution quotas</p>
          </div>
        </div>

        {/* Tab Selector & Filter Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            {/* Pill Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/70 border border-zinc-800/80 w-fit">
              <button
                onClick={() => setActiveTab('licenses')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'licenses'
                    ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Key className="h-3.5 w-3.5" />
                <span>Licenses</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                  {licenses.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('resellers')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'resellers'
                    ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Resellers</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                  {resellers.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'logs'
                    ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Telemetry</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                  {logs.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('docs')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'docs'
                    ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Integration Guide</span>
              </button>
            </div>

            {/* Search & Filters (only for licenses tab) */}
            {activeTab === 'licenses' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search key, email, customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-60 font-mono"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="revoked">Revoked</option>
                  <option value="expired">Expired</option>
                </select>

                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
                >
                  <option value="all">All Tiers</option>
                  <option value="agency">Agency</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="pro">Pro</option>
                  <option value="solo">Solo</option>
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: LICENSES */}
          {activeTab === 'licenses' && (
            <div>
              {filteredLicenses.length === 0 ? (
                <div className="p-12 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 text-center space-y-4">
                  <div className="inline-flex p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-500 shadow-inner">
                    <Key className="h-8 w-8" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="text-sm font-semibold text-zinc-200">No license keys found</h3>
                    <p className="text-xs text-zinc-500">
                      {search || statusFilter !== 'all' || tierFilter !== 'all'
                        ? 'No licenses match your current search and filter criteria.'
                        : 'Issue your first cryptographic Ed25519 license key to grant access to a buyer or client.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCreatedLicense(null);
                      setShowCreateLicense(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Issue First License</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/60 border-b border-zinc-800/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4">License Key</th>
                          <th className="py-3.5 px-4">Customer</th>
                          <th className="py-3.5 px-4">Tier</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Domains</th>
                          <th className="py-3.5 px-4">Expiration</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {filteredLicenses.map((lic) => {
                          const isCopied = copiedKey === lic.key;
                          return (
                            <tr key={lic.id} className="hover:bg-zinc-800/30 transition-colors">
                              {/* License Key */}
                              <td className="py-3.5 px-4 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium">{lic.key}</span>
                                  <button
                                    onClick={() => handleCopy(lic.key, lic.key)}
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                                    title="Copy License Key"
                                  >
                                    {isCopied ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Customer */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <div className="font-medium text-zinc-200">{lic.customerName}</div>
                                  <div className="text-[11px] text-zinc-500 font-mono">{lic.customerEmail}</div>
                                </div>
                              </td>

                              {/* Tier */}
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium font-mono uppercase ${
                                    lic.tier === 'enterprise'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      : lic.tier === 'agency'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  }`}
                                >
                                  {lic.tier}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                    lic.status === 'active'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : lic.status === 'suspended'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      lic.status === 'active'
                                        ? 'bg-emerald-400'
                                        : lic.status === 'suspended'
                                        ? 'bg-amber-400'
                                        : 'bg-red-400'
                                    }`}
                                  />
                                  <span className="capitalize">{lic.status}</span>
                                </span>
                              </td>

                              {/* Domains */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-1">
                                  <div className="text-xs font-mono text-zinc-300">
                                    {lic.activatedDomains.length} / {lic.maxDomains}
                                  </div>
                                  <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        lic.activatedDomains.length >= lic.maxDomains
                                          ? 'bg-amber-400'
                                          : 'bg-emerald-400'
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          (lic.activatedDomains.length / lic.maxDomains) * 100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Expiry */}
                              <td className="py-3.5 px-4 text-xs font-mono text-zinc-400">
                                {lic.expiresAt ? (
                                  <span>{new Date(lic.expiresAt).toLocaleDateString()}</span>
                                ) : (
                                  <span className="text-emerald-400 font-medium">Lifetime</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {lic.status === 'active' ? (
                                    <button
                                      onClick={() => handleToggleStatus(lic, 'revoked')}
                                      className="px-2 py-1 rounded bg-zinc-800/80 hover:bg-red-500/10 hover:text-red-400 text-zinc-400 text-[11px] font-medium transition-colors cursor-pointer"
                                      title="Revoke License"
                                    >
                                      Revoke
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleToggleStatus(lic, 'active')}
                                      className="px-2 py-1 rounded bg-zinc-800/80 hover:bg-emerald-500/10 hover:text-emerald-400 text-zinc-400 text-[11px] font-medium transition-colors cursor-pointer"
                                      title="Reactivate License"
                                    >
                                      Activate
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleRenew(lic, 30)}
                                    className="px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 text-[11px] font-medium transition-colors cursor-pointer"
                                    title="Add 30 Days"
                                  >
                                    +30d
                                  </button>

                                  <button
                                    onClick={() => handleDelete(lic)}
                                    className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                                    title="Delete License"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RESELLERS */}
          {activeTab === 'resellers' && (
            <div>
              {resellers.length === 0 ? (
                <div className="p-12 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 text-center space-y-4">
                  <div className="inline-flex p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-500 shadow-inner">
                    <Users className="h-8 w-8" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="text-sm font-semibold text-zinc-200">No reseller partners configured</h3>
                    <p className="text-xs text-zinc-500">
                      Create reseller accounts to allocate license issuance quotas to white-label partners or agencies.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateReseller(true)}
                    className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add First Reseller</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/60 border-b border-zinc-800/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4">Reseller Name</th>
                          <th className="py-3.5 px-4">Contact Email</th>
                          <th className="py-3.5 px-4">API Key</th>
                          <th className="py-3.5 px-4">Quota Usage</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {resellers.map((reseller) => {
                          const isKeyCopied = copiedKey === reseller.apiKey;
                          return (
                            <tr key={reseller.id} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="py-3.5 px-4 font-medium text-zinc-200">{reseller.name}</td>
                              <td className="py-3.5 px-4 font-mono text-zinc-400">{reseller.email}</td>
                              <td className="py-3.5 px-4 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="text-zinc-300">
                                    {reseller.apiKey.slice(0, 10)}...{reseller.apiKey.slice(-4)}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(reseller.apiKey, reseller.apiKey)}
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                                  >
                                    {isKeyCopied ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="space-y-1">
                                  <div className="text-xs font-mono text-zinc-300">
                                    {reseller.quotaUsed} / {reseller.quotaLimit}
                                  </div>
                                  <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-purple-400"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          (reseller.quotaUsed / reseller.quotaLimit) * 100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                                  {reseller.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-zinc-500">
                                {new Date(reseller.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TELEMETRY & LOGS */}
          {activeTab === 'logs' && (
            <div>
              {logs.length === 0 ? (
                <div className="p-12 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 text-center space-y-3">
                  <Activity className="h-8 w-8 text-zinc-500 mx-auto" />
                  <h3 className="text-sm font-semibold text-zinc-200">No telemetry recorded yet</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Heartbeat checks, domain activations, and verification pings will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-zinc-950/60 border-b border-zinc-800/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">License Key</th>
                          <th className="py-3 px-4">Domain / IP</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 font-sans">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors text-xs">
                            <td className="py-3 px-4 font-mono text-zinc-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] uppercase">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-white">{log.licenseKey}</td>
                            <td className="py-3 px-4 font-mono text-zinc-400">
                              {log.domain || '-'} {log.ip ? `(${log.ip})` : ''}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase ${
                                  log.status === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-400 text-xs">{log.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INTEGRATION GUIDE */}
          {activeTab === 'docs' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: How Buyers Activate */}
                <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Terminal className="h-5 w-5" />
                    <h3 className="text-sm font-semibold text-white">1. Buyer SaaS Activation</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    When you sell the ScanFix source code, buyers deploy their own instance. They activate their license via the web setup wizard at <code className="text-emerald-400 font-mono">/setup</code> or by setting their environment variable.
                  </p>
                  <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 font-mono text-xs text-zinc-300 space-y-1">
                    <div className="text-zinc-500"># In buyer's .env.local:</div>
                    <div>LICENSE_SERVER_URL=https://scanfix-license-server.vercel.app</div>
                    <div>LICENSE_KEY=SF-XXXX-XXXX-XXXX-XXXX</div>
                  </div>
                </div>

                {/* Card 2: Remote Kill-Switch */}
                <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-4">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Lock className="h-5 w-5" />
                    <h3 className="text-sm font-semibold text-white">2. Remote Kill-Switch & Domain Lock</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Buyer instances phone home to verify their digital signature. If a buyer charges back or violates your terms, click <strong>"Revoke"</strong> on the dashboard. Their instance will be locked on their next check-in.
                  </p>
                  <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 font-mono text-xs text-zinc-300 space-y-1">
                    <div className="text-zinc-500"># Offline Grace Period:</div>
                    <div>7 days offline tolerance before requiring a successful heartbeat check-in.</div>
                  </div>
                </div>
              </div>

              {/* API Endpoints Table */}
              <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  <span>Public & Admin API Endpoints</span>
                </h3>
                <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-zinc-300">POST /api/v1/license/activate</span>
                    <span className="text-zinc-500">Activates key & binds customer domain</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-zinc-300">POST /api/v1/license/verify</span>
                    <span className="text-zinc-500">Heartbeat check-in & kill-switch validation</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-zinc-300">GET /api/v1/license/public-key</span>
                    <span className="text-zinc-500">Returns Ed25519 public key for local verification</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-zinc-300">POST /api/v1/admin/licenses</span>
                    <span className="text-zinc-500">Admin/Reseller license creation (Protected)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: ISSUE NEW LICENSE */}
      {showCreateLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Issue New License</h3>
                  <p className="text-xs text-zinc-500">Generate a cryptographically signed key</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateLicense(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {createdLicense ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">License Generated Successfully!</h4>
                  <p className="text-xs text-zinc-400">Deliver this license key to your customer.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">{createdLicense.key}</span>
                  <button
                    onClick={() => handleCopy(createdLicense.key, 'modal-key')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'modal-key' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="text-white font-medium">{createdLicense.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-mono text-white">{createdLicense.customerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tier:</span>
                    <span className="uppercase font-mono text-emerald-400">{createdLicense.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Domains:</span>
                    <span className="font-mono text-white">{createdLicense.maxDomains}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowCreateLicense(false)}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateLicense} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Customer Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Agency"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Customer Email</label>
                    <input
                      type="email"
                      required
                      placeholder="buyer@agency.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-mono"
                    />
                  </div>
                </div>

                {/* Tier Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Plan Tier</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['solo', 'pro', 'agency', 'enterprise'] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setTier(t)}
                        className={`py-2 px-2 rounded-xl text-xs font-medium uppercase font-mono transition-all cursor-pointer ${
                          tier === t
                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Max Allowed Domains</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxDomains}
                      onChange={(e) => setMaxDomains(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Duration</label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                    >
                      <option value="365">1 Year (365 days)</option>
                      <option value="180">6 Months (180 days)</option>
                      <option value="30">1 Month (30 days)</option>
                      <option value="lifetime">Lifetime (No Expiry)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">
                    Allowed Domains <span className="text-zinc-500 font-normal">(* for any domain)</span>
                  </label>
                  <input
                    type="text"
                    value={allowedDomains}
                    onChange={(e) => setAllowedDomains(e.target.value)}
                    placeholder="* or app.client.com, staging.client.com"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Signing with Ed25519...' : 'Generate & Issue License Key'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD RESELLER */}
      {showCreateReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Add Reseller Partner</h3>
              </div>
              <button
                onClick={() => setShowCreateReseller(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReseller} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Partner Organization / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Cloud Solutions"
                  value={resellerName}
                  onChange={(e) => setResellerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Partner Contact Email</label>
                <input
                  type="email"
                  required
                  placeholder="partner@agency.com"
                  value={resellerEmail}
                  onChange={(e) => setResellerEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">License Issuance Quota</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={resellerQuota}
                  onChange={(e) => setResellerQuota(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 font-semibold text-xs transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
              >
                {isSubmitting ? 'Creating...' : 'Create Reseller Partner'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PUBLIC KEY */}
      {showPublicKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Ed25519 Public Key</h3>
              </div>
              <button
                onClick={() => setShowPublicKeyModal(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              This public key is distributed to client instances to verify digitally signed license tokens offline.
            </p>

            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all leading-relaxed">
                {publicKey || 'Loading key...'}
              </pre>
            </div>

            <button
              onClick={() => handleCopy(publicKey, 'pubkey-modal')}
              className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedKey === 'pubkey-modal' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Public Key Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Public Key</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
