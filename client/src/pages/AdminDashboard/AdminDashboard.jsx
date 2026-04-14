import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import {
  getAdminDashboard, getPendingClaims, getFinancialSummary,
  getZoneTrustScores, getZones, getTriggerSources, getPredictiveClaims, simulateDisruption, toggleBandh, reviewClaim, adminLogin, getAllWorkers
} from '../../api'

const EVENT_TYPES = ['HEAVY_RAIN', 'EXTREME_HEAT', 'HIGH_AQI', 'NDMA_ALERT', 'BANDH']
const SCENARIO_PRESETS = {
  clean_day: { event_type: 'HEAVY_RAIN', raw_value: 72.5, force_t2: true, simulation_duration_days: 1, is_honeypot: false },
  duplicate_attempt: { event_type: 'HEAVY_RAIN', raw_value: 72.5, force_t2: true, simulation_duration_days: 1, is_honeypot: false },
  velocity_attack: { event_type: 'HEAVY_RAIN', raw_value: 78.0, force_t2: true, simulation_duration_days: 3, is_honeypot: false },
  honeypot: { event_type: 'HIGH_AQI', raw_value: 420, force_t2: true, simulation_duration_days: 1, is_honeypot: true },
  monsoon_14day: { event_type: 'HEAVY_RAIN', raw_value: 85.0, force_t2: true, simulation_duration_days: 14, is_honeypot: false },
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, setAdmin, setAdminAuth, logout } = useStore()

  const [tab, setTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [pendingClaims, setPendingClaims] = useState([])
  const [financial, setFinancial] = useState(null)
  const [trustScores, setTrustScores] = useState([])
  const [triggerSources, setTriggerSources] = useState(null)
  const [zones, setZones] = useState([])
  const [workers, setWorkers] = useState([])
  const [predictive, setPredictive] = useState(null)
  const [workerSearch, setWorkerSearch] = useState('')
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [preset, setPreset] = useState('clean_day')
  const [simForm, setSimForm] = useState({
    zone_id: '',
    event_type: 'HEAVY_RAIN',
    raw_value: 72.5,
    force_t2: true,
    simulation_start_at: new Date().toISOString().slice(0, 16),
    simulation_duration_days: 1,
    is_honeypot: false,
  })
  const [simResult, setSimResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const isMockMode = Boolean(triggerSources?.mock_mode)

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
    const [d, p, f, t, z, s, w, pr] = await Promise.allSettled([
      getAdminDashboard(), getPendingClaims(), getFinancialSummary(), getZoneTrustScores(), getZones(), getTriggerSources(), getAllWorkers(), getPredictiveClaims()
    ])
    if (d.status === 'fulfilled') setDashboard(d.value.data)
    if (p.status === 'fulfilled') setPendingClaims(p.value.data)
    if (f.status === 'fulfilled') setFinancial(f.value.data)
    if (t.status === 'fulfilled') setTrustScores(t.value.data)
    if (z.status === 'fulfilled') { setZones(z.value.data) }
    if (s.status === 'fulfilled') setTriggerSources(s.value.data)
    if (w.status === 'fulfilled') setWorkers(w.value.data)
    if (pr.status === 'fulfilled') setPredictive(pr.value.data)
  }

  const handleSimulate = async () => {
    setLoading(true)
    setSimResult(null)
    try {
      const payload = {
        ...simForm,
        simulation_duration_days: Number(simForm.simulation_duration_days || 1),
        simulation_start_at: simForm.simulation_start_at ? new Date(simForm.simulation_start_at).toISOString() : null,
      }
      const res = await simulateDisruption(payload)
      setSimResult(res.data)
      loadAll()
    } catch (e) {
      setSimResult({ error: e.response?.data?.detail || 'Simulation failed' })
    } finally {
      setLoading(false)
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

  const TABS = ['overview', 'workers', 'claims', 'simulate', 'zones']

  const filteredWorkers = workers.filter((w) => {
    const q = workerSearch.trim().toLowerCase()
    if (!q) return true
    return (
      (w.full_name || '').toLowerCase().includes(q)
      || (w.phone || '').toLowerCase().includes(q)
      || (w.platform || '').toLowerCase().includes(q)
      || (w.upi_id || '').toLowerCase().includes(q)
      || (w.trust_tier || '').toLowerCase().includes(q)
    )
  })

  const selectedWorker = filteredWorkers.find((w) => w.id === selectedWorkerId) || filteredWorkers[0] || null

  const applyPreset = (key) => {
    const next = SCENARIO_PRESETS[key]
    if (!next) return
    setPreset(key)
    setSimForm((f) => ({
      ...f,
      ...next,
      simulation_start_at: new Date().toISOString().slice(0, 16),
    }))
  }

  const handleAdminLogin = async () => {
    setLoginError('')
    try {
      const res = await adminLogin(adminPin)
      setAdminAuth(res.data.access_token)
      setAdmin(true)
    } catch (e) {
      setLoginError(e?.response?.data?.detail || 'Invalid admin credentials')
    }
  }

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
            onClick={handleAdminLogin}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
          >
            Enter
          </button>
          {loginError && <p className="text-xs text-red-600">{loginError}</p>}
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
        <h1 className="text-xl font-bold">Hermetical Admin</h1>
        <div className="flex gap-4">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`capitalize text-sm px-3 py-1 rounded-lg ${tab === t ? 'bg-white text-gray-900 font-medium' : 'text-gray-300 hover:text-white'}`}>
              {t}
            </button>
          ))}
          <button onClick={() => { logout(); navigate('/') }} className="text-gray-400 hover:text-white text-sm ml-2">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Overview */}
        {tab === 'overview' && dashboard && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Active Policies', value: dashboard.total_active_policies },
                { label: 'Disruptions (7d)', value: dashboard.disruptions_this_week },
                { label: 'Claims (7d)', value: dashboard.total_claims_this_week },
                { label: 'Payouts (7d)', value: `₹${(dashboard.total_payouts_this_week || 0).toFixed(0)}` },
                { label: 'Avg Payout Time', value: financial?.avg_payout_seconds != null ? `${financial.avg_payout_seconds.toFixed(1)}s` : '—' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">{m.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-2">{m.value}</p>
                </div>
              ))}
            </div>

            {triggerSources && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Trigger Source Health</h3>
                {isMockMode && (
                  <p className="mb-3 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    MOCK MODE ACTIVE: all trigger sources are served from deterministic offline mocks.
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {Object.entries(triggerSources)
                    .filter(([_, v]) => v && typeof v === 'object' && 'configured' in v)
                    .map(([k, v]) => (
                    <div key={k} className="border border-gray-100 rounded-lg p-3">
                      <div className="font-medium capitalize">{k.replace('_', ' ')}</div>
                      <div className="text-gray-500">Configured: {String(v.configured)}</div>
                      <div className={v.reachable ? 'text-green-600' : 'text-red-600'}>
                        Reachable: {String(v.reachable)}
                      </div>
                      {v.note && <div className="text-gray-400 text-xs mt-1">{v.note}</div>}
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

            {predictive && (
              <div className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700">Next Week Predictive Claims</h3>
                  <span className="text-xs text-gray-400">7d horizon</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs text-indigo-600">Projected Claims</p>
                    <p className="text-2xl font-bold text-indigo-700">{Number(predictive.total_projected_claims || 0).toFixed(1)}</p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="text-xs text-rose-600">Projected Exposure</p>
                    <p className="text-2xl font-bold text-rose-700">₹{Number(predictive.total_projected_exposure || 0).toFixed(0)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(predictive.zones || []).map((z) => (
                    <div key={z.zone_id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 text-sm">
                      <span className="text-gray-700">{z.zone_name}</span>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">{Number(z.projected_claims_next_7d || 0).toFixed(1)} claims</p>
                        <p className="text-xs text-gray-400">₹{Number(z.projected_payout_exposure || 0).toFixed(0)} exposure</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Claims Review */}
        {tab === 'workers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow p-4 lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700">Drivers</h3>
                <span className="text-xs text-gray-500">{filteredWorkers.length}/{workers.length}</span>
              </div>
              <input
                type="text"
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                placeholder="Search name, phone, platform..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {filteredWorkers.length === 0 && (
                  <p className="text-sm text-gray-400">No drivers matched your search.</p>
                )}
                {filteredWorkers.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWorkerId(w.id)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${selectedWorker?.id === w.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
                  >
                    <p className="font-medium text-gray-800 truncate">{w.full_name}</p>
                    <p className="text-xs text-gray-500">{w.phone} • {w.platform}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
              {!selectedWorker ? (
                <p className="text-gray-400 text-sm">Select a driver to inspect details.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{selectedWorker.full_name}</h3>
                      <p className="text-xs text-gray-500">Driver ID: {selectedWorker.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedWorker.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedWorker.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">Phone</p>
                      <p className="font-medium text-gray-800">{selectedWorker.phone}</p>
                    </div>
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">UPI</p>
                      <p className="font-medium text-gray-800">{selectedWorker.upi_id}</p>
                    </div>
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">Platform</p>
                      <p className="font-medium text-gray-800">{selectedWorker.platform}</p>
                    </div>
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">Zone ID</p>
                      <p className="font-medium text-gray-800 break-all">{selectedWorker.zone_id}</p>
                    </div>
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">Weekly Income</p>
                      <p className="font-medium text-gray-800">₹{Number(selectedWorker.avg_weekly_income || 0).toFixed(0)}</p>
                    </div>
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">Declared Weekly Hours</p>
                      <p className="font-medium text-gray-800">{selectedWorker.declared_weekly_hours}</p>
                    </div>
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">Trust Tier</p>
                      <p className="font-medium text-gray-800">{selectedWorker.trust_tier}</p>
                    </div>
                    <div className="border border-gray-100 rounded-lg p-3">
                      <p className="text-gray-500">KYC</p>
                      <p className={`font-medium ${selectedWorker.kyc_verified ? 'text-green-700' : 'text-yellow-700'}`}>
                        {selectedWorker.kyc_verified ? 'Verified' : 'Pending'}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Registered: {selectedWorker.registration_date ? new Date(selectedWorker.registration_date).toLocaleString('en-IN') : '—'}
                  </div>
                </div>
              )}
            </div>
          </div>
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

        {/* Simulate Disruption */}
        {tab === 'simulate' && (
          <div className="bg-white rounded-xl shadow p-4 space-y-4">
            <h3 className="font-semibold text-gray-700">Simulate Disruption</h3>
            <p className="text-sm text-gray-500">Trigger the full DTPM pipeline for demo purposes. Runs trigger evaluation → claims → payouts → LLM explanations.</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Dual-trigger gate active (T1 and T2 required)
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Scenario Preset</label>
              <select value={preset} onChange={e => applyPreset(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {Object.keys(SCENARIO_PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
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
              <div>
                <label className="text-xs text-gray-500 block mb-1">Simulation Start</label>
                <input type="datetime-local" value={simForm.simulation_start_at}
                  onChange={e => setSimForm(f => ({ ...f, simulation_start_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Duration (days)</label>
                <input type="number" min={1} max={30} value={simForm.simulation_duration_days}
                  onChange={e => setSimForm(f => ({ ...f, simulation_duration_days: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={simForm.is_honeypot}
                    onChange={e => setSimForm(f => ({ ...f, is_honeypot: e.target.checked }))} />
                  Honeypot Event (fraud trap)
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
                  <div>Duration: <span className="font-medium">{simResult.simulation_duration_days} day(s)</span></div>
                  <div>Honeypot: <span className="font-medium">{simResult.is_honeypot ? 'Yes' : 'No'}</span></div>
                  <div>Claims created: <span className="font-medium">{simResult.claims_created}</span></div>
                  <div>Skipped: <span className="font-medium">{simResult.skipped_workers}</span></div>
                </div>
                <div className="text-xs text-gray-500">
                  Window: {new Date(simResult.simulation_start_at).toLocaleString('en-IN')} → {simResult.simulation_end_at ? new Date(simResult.simulation_end_at).toLocaleString('en-IN') : 'ongoing'}
                </div>
              </div>
            )}
            {simResult?.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{simResult.error}</div>
            )}
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
