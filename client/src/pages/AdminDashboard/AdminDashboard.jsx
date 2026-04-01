import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import {
  getAdminDashboard, getPendingClaims, getFinancialSummary,
  getZoneTrustScores, getZones, simulateDisruption, toggleBandh, reviewClaim
} from '../../api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const ZONE_COLORS = { low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' }
const EVENT_TYPES = ['HEAVY_RAIN', 'EXTREME_HEAT', 'HIGH_AQI', 'NDMA_ALERT', 'BANDH']

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, setAdmin } = useStore()

  const [tab, setTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [pendingClaims, setPendingClaims] = useState([])
  const [financial, setFinancial] = useState(null)
  const [trustScores, setTrustScores] = useState([])
  const [zones, setZones] = useState([])
  const [simForm, setSimForm] = useState({ zone_id: '', event_type: 'HEAVY_RAIN', raw_value: 72.5, force_t2: true })
  const [simResult, setSimResult] = useState(null)
  const [loading, setLoading] = useState(false)

  // Admin gate
  const [adminPin, setAdminPin] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    loadAll()
    const i = setInterval(loadAll, 30000)
    return () => clearInterval(i)
  }, [isAdmin])

  const loadAll = async () => {
    const [d, p, f, t, z] = await Promise.allSettled([
      getAdminDashboard(), getPendingClaims(), getFinancialSummary(), getZoneTrustScores(), getZones()
    ])
    if (d.status === 'fulfilled') setDashboard(d.value.data)
    if (p.status === 'fulfilled') setPendingClaims(p.value.data)
    if (f.status === 'fulfilled') setFinancial(f.value.data)
    if (t.status === 'fulfilled') setTrustScores(t.value.data)
    if (z.status === 'fulfilled') { setZones(z.value.data); if (z.value.data[0]) setSimForm(f => ({ ...f, zone_id: z.value.data[0].id })) }
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

  const handleBandh = async (zoneId, active) => {
    await toggleBandh({ zone_id: zoneId, active })
    loadAll()
  }

  const handleReview = async (claimId, action) => {
    await reviewClaim(claimId, { action })
    loadAll()
  }

  const TABS = ['overview', 'claims', 'simulate', 'zones']

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
          <button onClick={() => setAdmin(false)} className="text-gray-400 hover:text-white text-sm ml-4">Logout</button>
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
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Pending Claims ({pendingClaims.length})</h3>
            {pendingClaims.length === 0 && <p className="text-gray-400 text-sm">No claims pending review.</p>}
            <div className="space-y-3">
              {pendingClaims.map(c => (
                <div key={c.id} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Claim {c.id.slice(0, 8)}…</p>
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
        )}

        {/* Simulate Disruption */}
        {tab === 'simulate' && (
          <div className="bg-white rounded-xl shadow p-4 space-y-4">
            <h3 className="font-semibold text-gray-700">Simulate Disruption</h3>
            <p className="text-sm text-gray-500">Trigger the full DTPM pipeline for demo purposes. Runs trigger evaluation → claims → payouts → LLM explanations.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Zone</label>
                <select value={simForm.zone_id} onChange={e => setSimForm(f => ({ ...f, zone_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
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
