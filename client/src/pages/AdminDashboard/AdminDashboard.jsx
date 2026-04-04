import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import {
  getAdminDashboard, getPendingClaims, getFinancialSummary,
  getZoneTrustScores, getZones, getTriggerSources, getAllWorkers,
  simulateDisruption, toggleBandh, reviewClaim, globalReset
} from '../../api'

const EVENT_TYPES = ['HEAVY_RAIN', 'EXTREME_HEAT', 'HIGH_AQI', 'NDMA_ALERT', 'BANDH']

const SCENARIO_PRESETS = {
  clean_day:        { label: 'Clean Day',         event_type: 'HEAVY_RAIN',   raw_value: 72.5, force_t2: true },
  monsoon_14day:    { label: 'Monsoon (14-day)',   event_type: 'HEAVY_RAIN',   raw_value: 85.0, force_t2: true },
  heatwave:         { label: 'Extreme Heat',       event_type: 'EXTREME_HEAT', raw_value: 42.0, force_t2: true },
  aqi_spike:        { label: 'AQI Spike',          event_type: 'HIGH_AQI',     raw_value: 420,  force_t2: true },
  bandh:            { label: 'Bandh',              event_type: 'BANDH',        raw_value: 1.0,  force_t2: true },
  honeypot:         { label: 'Honeypot (fraud)',   event_type: 'HIGH_AQI',     raw_value: 420,  force_t2: true },
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, setAdmin } = useStore()

  const [tab, setTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [pendingClaims, setPendingClaims] = useState([])
  const [financial, setFinancial] = useState(null)
  const [trustScores, setTrustScores] = useState([])
  const [zones, setZones] = useState([])
  const [triggerSources, setTriggerSources] = useState(null)
  const [workers, setWorkers] = useState([])
  const [workerSearch, setWorkerSearch] = useState('')
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [preset, setPreset] = useState('clean_day')
  const [simForm, setSimForm] = useState({ zone_id: '', event_type: 'HEAVY_RAIN', raw_value: 72.5, force_t2: true })
  const [simResult, setSimResult] = useState(null)
  const [resetResult, setResetResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Admin gate
  const [adminPin, setAdminPin] = useState('')

  useEffect(() => {
    if (!isAdmin) {
      setAdminPin('')
      return
    }
    loadAll()
    const i = setInterval(loadAll, 30000)
    return () => clearInterval(i)
  }, [isAdmin])

  const loadAll = async () => {
    const [d, p, f, t, z, s, w] = await Promise.allSettled([
      getAdminDashboard(), getPendingClaims(), getFinancialSummary(),
      getZoneTrustScores(), getZones(), getTriggerSources(), getAllWorkers()
    ])
    if (d.status === 'fulfilled') setDashboard(d.value.data)
    if (p.status === 'fulfilled') setPendingClaims(p.value.data)
    if (f.status === 'fulfilled') setFinancial(f.value.data)
    if (t.status === 'fulfilled') setTrustScores(t.value.data)
    if (z.status === 'fulfilled') setZones(z.value.data)
    if (s.status === 'fulfilled') setTriggerSources(s.value.data)
    if (w.status === 'fulfilled') setWorkers(w.value.data)
  }

  const applyPreset = (key) => {
    const p = SCENARIO_PRESETS[key]
    if (!p) return
    setPreset(key)
    setSimForm(f => ({ ...f, event_type: p.event_type, raw_value: p.raw_value, force_t2: p.force_t2 }))
  }

  const handleSimulate = async () => {
    setLoading(true)
    setSimResult(null)
    try {
      const res = await simulateDisruption(simForm)
      setSimResult(res.data)
      loadAll()
    } catch (e) {
      setSimResult({ error: e.response?.data?.detail || 'Simulation failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleGlobalReset = async () => {
    setResetting(true)
    setResetResult(null)
    try {
      const res = await globalReset()
      setResetResult(res.data)
      loadAll()
    } catch (e) {
      setResetResult({ error: 'Reset failed' })
    } finally {
      setResetting(false)
    }
  }

  const handleBandh = async (zoneId, active) => {
    await toggleBandh({ zone_id: zoneId, active })
    loadAll()
  }

  const handleReview = async (claimId, action) => {
    await reviewClaim(claimId, { action })
    loadAll()
  }

  const filteredWorkers = workers.filter(w => {
    const q = workerSearch.trim().toLowerCase()
    if (!q) return true
    return (w.full_name || '').toLowerCase().includes(q)
      || (w.phone || '').includes(q)
      || (w.platform || '').toLowerCase().includes(q)
  })
  const selectedWorker = workers.find(w => w.id === selectedWorkerId) || filteredWorkers[0] || null

  const TABS = ['overview', 'workers', 'claims', 'simulate', 'zones']

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">Admin Login</h1>
          <input
            type="password"
            placeholder="PIN"
            value={adminPin}
            onChange={e => setAdminPin(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest"
          />
          <button
            onClick={() => { if (adminPin === 'admin123') setAdmin(true) }}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
          >
            Enter
          </button>
          <p className="text-xs text-gray-400">PIN: admin123 (demo)</p>
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 underline">
            Back to home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">RainReady Admin</h1>
        <div className="flex gap-4">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`capitalize text-sm px-3 py-1 rounded-lg ${tab === t ? 'bg-white text-gray-900 font-medium' : 'text-gray-300 hover:text-white'}`}>
              {t}
            </button>
          ))}
          <button onClick={() => { setAdmin(false); navigate('/') }} className="text-gray-400 hover:text-white text-sm ml-2">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Overview */}
        {tab === 'overview' && dashboard && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Active Policies', value: dashboard.total_active_policies },
                { label: 'Disruptions (7d)', value: dashboard.disruptions_this_week },
                { label: 'Claims (7d)', value: dashboard.total_claims_this_week },
                { label: 'Payouts (7d)', value: `₹${(dashboard.total_payouts_this_week || 0).toFixed(0)}` },
                { label: 'Avg Payout Time', value: financial?.avg_payout_seconds != null ? `${financial.avg_payout_seconds.toFixed(1)}s` : '—' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl shadow p-4">
                  <p className="text-gray-500 text-sm">{m.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{m.value}</p>
                </div>
              ))}
            </div>

            {triggerSources && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Trigger Source Health</h3>
                {triggerSources.mock_mode && (
                  <p className="mb-3 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    MOCK MODE — trigger sources are served from deterministic offline mocks
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {Object.entries(triggerSources).filter(([k]) => k !== 'mock_mode').map(([k, v]) => (
                    <div key={k} className="border border-gray-100 rounded-lg p-2">
                      <div className="font-medium text-gray-700 capitalize">{k.replace('_', ' ')}</div>
                      <div className={v.reachable ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>
                        {v.reachable ? 'Reachable' : 'Unreachable'}
                      </div>
                      {v.note && <div className="text-gray-400 text-xs">{v.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Loss Ratio</h3>
                <p className="text-3xl font-bold text-blue-700">{(dashboard.loss_ratio * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-400 mt-1">Payouts / Premiums this week</p>
              </div>
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Pending Review</h3>
                <p className="text-3xl font-bold text-yellow-600">{dashboard.pending_review_count}</p>
                <button onClick={() => setTab('claims')} className="text-xs text-blue-600 underline mt-1">Review now</button>
              </div>
            </div>

            {/* Zone trust scores */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Zone Trust Scores</h3>
              <div className="space-y-2">
                {trustScores.map(z => (
                  <div key={z.zone_id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-gray-700">{z.zone_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{z.survey_count} surveys</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${z.avg_trust_score >= 4 ? 'bg-green-100 text-green-700' :
                          z.avg_trust_score >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {z.avg_trust_score !== null ? `${z.avg_trust_score}/5` : 'No data'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {financial && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Financial Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-gray-500">Total Premiums</p><p className="font-bold text-lg">₹{financial.total_premiums_collected.toFixed(2)}</p></div>
                  <div><p className="text-gray-500">Total Payouts</p><p className="font-bold text-lg text-blue-600">₹{financial.total_payouts_disbursed.toFixed(2)}</p></div>
                </div>
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-1">Claims by Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(financial.claims_by_status || {}).map(([status, count]) => (
                      <span key={status} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{status}: {count}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Claims Review */}
        {tab === 'claims' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Pending Claims ({pendingClaims.length})</h3>
              {pendingClaims.length === 0 && <p className="text-gray-400 text-sm">No claims pending review.</p>}
              <div className="space-y-3">
                {pendingClaims.map(c => (
                  <div key={c.id} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Claim {c.id.slice(0, 8)}…</p>
                        {c.decision_reason_code && (
                          <p className="text-xs font-semibold text-orange-700 mt-0.5">
                            Reason: {c.decision_reason_code.replace(/_/g, ' ')}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">Fraud score: <span className="font-medium text-red-600">{c.fraud_score.toFixed(2)}</span></p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {(c.fraud_flags || []).map(f => (
                            <span key={f} className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">{f}</span>
                          ))}
                        </div>
                      </div>
                      <span className="font-bold text-blue-700">₹{c.payout_amount?.toFixed(0)}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleReview(c.id, 'APPROVE')}
                        className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded-lg">Approve</button>
                      <button onClick={() => handleReview(c.id, 'REJECT')}
                        className="flex-1 py-1.5 bg-red-600 text-white text-sm rounded-lg">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fraud Intelligence Panel */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Fraud Intelligence</h3>
              {pendingClaims.length === 0 ? (
                <p className="text-gray-400 text-sm">No flagged claims detected.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{pendingClaims.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Flagged Claims</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {pendingClaims.length > 0 ? Math.max(...pendingClaims.map(c => c.fraud_score)).toFixed(2) : '0.00'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Highest Score</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        ₹{pendingClaims.reduce((sum, c) => sum + (c.payout_amount || 0), 0).toFixed(0)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Held Payout</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Active Fraud Signals</p>
                    <div className="flex gap-1 flex-wrap">
                      {[...new Set(pendingClaims.flatMap(c => c.fraud_flags || []))].map(flag => {
                        const count = pendingClaims.filter(c => (c.fraud_flags || []).includes(flag)).length
                        return (
                          <span key={flag} className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            {flag} ×{count}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workers Tab */}
        {tab === 'workers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow p-4 lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700">Workers</h3>
                <span className="text-xs text-gray-400">{filteredWorkers.length}/{workers.length}</span>
              </div>
              <input
                type="text"
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
                placeholder="Search name, phone, platform…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="space-y-2 max-h-[500px] overflow-auto pr-1">
                {filteredWorkers.length === 0 && <p className="text-sm text-gray-400">No workers found.</p>}
                {filteredWorkers.map(w => (
                  <button key={w.id} onClick={() => setSelectedWorkerId(w.id)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${selectedWorker?.id === w.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <p className="font-medium text-gray-800 truncate">{w.full_name}</p>
                    <p className="text-xs text-gray-500">{w.phone} · {w.platform}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
              {!selectedWorker ? (
                <p className="text-gray-400 text-sm">Select a worker to inspect.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{selectedWorker.full_name}</h3>
                      <p className="text-xs text-gray-500">{selectedWorker.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedWorker.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedWorker.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ['Phone', selectedWorker.phone],
                      ['UPI', selectedWorker.upi_id],
                      ['Platform', selectedWorker.platform],
                      ['Trust Tier', selectedWorker.trust_tier],
                      ['Weekly Income', `₹${Number(selectedWorker.avg_weekly_income || 0).toFixed(0)}`],
                      ['Hours/Week', selectedWorker.declared_weekly_hours],
                      ['Tenure', `${selectedWorker.tenure_weeks}w`],
                      ['KYC', selectedWorker.kyc_verified ? 'Verified' : 'Pending'],
                    ].map(([label, val]) => (
                      <div key={label} className="border border-gray-100 rounded-lg p-3">
                        <p className="text-gray-500">{label}</p>
                        <p className="font-medium text-gray-800">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Simulate Disruption */}
        {tab === 'simulate' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4 space-y-4">
              <h3 className="font-semibold text-gray-700">Simulate Disruption</h3>
              <p className="text-sm text-gray-500">Trigger the full DTPM pipeline for demo purposes. Runs trigger evaluation → claims → payouts → LLM explanations.</p>

              {/* Scenario presets */}
              <div>
                <label className="text-xs text-gray-500 block mb-2">Quick Presets</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(SCENARIO_PRESETS).map(([key, p]) => (
                    <button key={key} onClick={() => applyPreset(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                        ${preset === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Zone</label>
                  <select value={simForm.zone_id} onChange={e => setSimForm(f => ({ ...f, zone_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Select a zone —</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Event Type</label>
                  <select value={simForm.event_type} onChange={e => setSimForm(f => ({ ...f, event_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Raw Value (mm/hr, °C, or AQI)</label>
                  <input type="number" value={simForm.raw_value}
                    onChange={e => setSimForm(f => ({ ...f, raw_value: parseFloat(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={simForm.force_t2}
                      onChange={e => setSimForm(f => ({ ...f, force_t2: e.target.checked }))} />
                    Force T2 (order drop)
                  </label>
                </div>
              </div>
              <button onClick={handleSimulate} disabled={loading || !simForm.zone_id}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
                {loading ? 'Simulating…' : 'Fire Disruption'}
              </button>

              {simResult && !simResult.error && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-2">
                  <p className="font-semibold text-green-800">{simResult.message}</p>
                  <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <div>T1 confirmed: <span className={simResult.t1_confirmed ? 'text-green-600 font-medium' : 'text-red-600'}>{simResult.t1_confirmed ? 'Yes' : 'No'}</span></div>
                    <div>T2 confirmed: <span className={simResult.t2_confirmed ? 'text-green-600 font-medium' : 'text-red-600'}>{simResult.t2_confirmed ? 'Yes' : 'No'}</span></div>
                    <div>Severity: <span className="font-medium">{simResult.severity_score?.toFixed(1)}/100</span></div>
                    <div>Payout tier: <span className="font-medium">{simResult.payout_tier}</span></div>
                    <div>Claims created: <span className="font-medium">{simResult.claims_created}</span></div>
                    <div>Skipped: <span className="font-medium">{simResult.skipped_workers}</span></div>
                  </div>
                </div>
              )}
              {simResult?.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{simResult.error}</div>
              )}
            </div>

            {/* Global Reset */}
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <h3 className="font-semibold text-gray-700">Global Reset</h3>
              <p className="text-sm text-gray-500">Closes all open disruption events and resets all zone order-drop and bandh flags back to baseline. Use before a clean demo run.</p>
              <button onClick={handleGlobalReset} disabled={resetting}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
                {resetting ? 'Resetting…' : 'Reset All Disruptions & Flags'}
              </button>
              {resetResult && !resetResult.error && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                  {resetResult.message}
                </div>
              )}
              {resetResult?.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{resetResult.error}</div>
              )}
            </div>
          </div>
        )}

        {/* Zone Management */}
        {tab === 'zones' && (
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Zone Control</h3>
            <div className="space-y-3">
              {zones.map(z => (
                <div key={z.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">{z.name}</p>
                    <p className="text-xs text-gray-400">Risk mult: {z.risk_multiplier}×</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {z.bandh_active && <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">BANDH ACTIVE</span>}
                    <button onClick={() => handleBandh(z.id, true)} disabled={z.bandh_active}
                      className={`px-3 py-1.5 text-xs rounded-lg ${z.bandh_active ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                      Activate Bandh
                    </button>
                    <button onClick={() => handleBandh(z.id, false)} disabled={!z.bandh_active}
                      className={`px-3 py-1.5 text-xs rounded-lg ${!z.bandh_active ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      Clear Bandh
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
