import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import { getWorkerDashboard, submitSurvey, pausePolicy, updatePolicy, createPolicy } from '../../api'

const STATUS_COLORS = {
  AUTO_APPROVED: 'bg-green-100 text-green-700',
  MANUAL_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const DISRUPTION_COLORS = {
  HEAVY_RAIN: '🌧️',
  EXTREME_HEAT: '🌡️',
  HIGH_AQI: '💨',
  NDMA_ALERT: '🚨',
  BANDH: '🚫',
  ORDER_DROP: '📉',
}

export default function WorkerDashboard() {
  const navigate = useNavigate()
  const { workerId, workerData: cachedWorker, logout } = useStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [surveyClaimId, setSurveyClaimId] = useState(null)
  const [survey, setSurvey] = useState({ understood_reason: true, payout_correct: true, trust_score: 5 })

  useEffect(() => {
    if (!workerId) { navigate('/'); return }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [workerId])

  const load = async () => {
    try {
      const res = await getWorkerDashboard(workerId)
      setData(res.data)
      setError(null)
    } catch (e) {
      if (e?.response?.status === 404) {
        logout()
        navigate('/')
        return
      }
      setError('Could not load dashboard. Retrying...')
    } finally {
      setLoading(false)
    }
  }

  const handlePause = async () => {
    if (!data?.active_policy) return
    await pausePolicy(data.active_policy.id)
    load()
  }

  const handleResume = async () => {
    if (!data?.active_policy) return
    await updatePolicy(data.active_policy.id, { status: 'ACTIVE' })
    load()
  }

  const handleGetCoverage = async () => {
    try {
      await createPolicy(workerId)
    } catch (e) {
      // 409 means a policy already exists (e.g. paused) — just reload to show it
      if (e?.response?.status !== 409) {
        setError(e?.response?.data?.detail || 'Could not create policy')
        return
      }
    }
    load()
  }

  const handleSurveySubmit = async () => {
    await submitSurvey(surveyClaimId, survey)
    setSurveyClaimId(null)
    load()
  }

  if (loading && !data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-blue-600 text-lg font-medium animate-pulse">Loading your dashboard...</div>
    </div>
  )

  const { worker, active_policy, recent_claims, active_disruptions, earnings_protected } = data || {}
  const displayWorker = worker || cachedWorker

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-blue-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <span className="text-xl font-bold">Hermetical</span>
          <span className="ml-3 text-blue-300 text-sm">{displayWorker?.trust_tier?.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {displayWorker?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-blue-200 text-sm">{displayWorker?.full_name}</span>
          </div>
          <button onClick={() => { logout(); navigate('/') }}
            className="text-blue-300 hover:text-white text-sm underline">Logout</button>
        </div>
      </nav>

      {error && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-700 text-sm text-center py-2">{error}</div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Active Disruptions */}
        {active_disruptions?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="font-semibold text-red-700 mb-2">⚠️ Active Disruption in Your Zone</h3>
            {active_disruptions.map(d => (
              <div key={d.id} className="flex justify-between items-center">
                <span>{DISRUPTION_COLORS[d.event_type] || '⚡'} {d.event_type.replace('_', ' ')}</span>
                <span className="text-sm font-medium text-red-600">Severity: {d.severity_score.toFixed(0)}/100</span>
              </div>
            ))}
          </div>
        )}

        {/* Policy Card */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Your Coverage</h2>
              {active_policy ? (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-2 items-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                      ${active_policy.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {active_policy.status}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">₹{active_policy.weekly_premium?.toFixed(2)}<span className="text-sm font-normal text-gray-500">/week</span></p>
                  <p className="text-gray-500 text-sm">Max payout: ₹{active_policy.coverage_amount?.toFixed(2)}</p>
                </div>
              ) : (
                <p className="text-gray-500 mt-2">No active policy. <button onClick={handleGetCoverage} className="text-blue-600 underline">Get covered →</button></p>
              )}
            </div>
            {active_policy && (
              <button
                onClick={active_policy.status === 'ACTIVE' ? handlePause : handleResume}
                className="text-sm text-gray-500 hover:text-gray-800 underline"
              >
                {active_policy.status === 'ACTIVE' ? 'Pause' : 'Resume'}
              </button>
            )}
          </div>
        </div>

        {/* Earnings Protected */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-green-700">Total income protected</p>
            <p className="text-2xl font-bold text-green-800">₹{(earnings_protected || 0).toFixed(2)}</p>
          </div>
          <div className="text-4xl">🛡️</div>
        </div>

        {/* Recent Claims */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Claims</h2>
          {recent_claims?.length === 0 && (
            <p className="text-gray-400 text-sm">No claims yet. When a disruption hits your zone, claims appear here automatically.</p>
          )}
          <div className="space-y-3">
            {recent_claims?.map(claim => (
              <div key={claim.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[claim.status] || ''}`}>
                        {claim.status.replace('_', ' ')}
                      </span>
                      {claim.duration_hours > 0 && (
                        <span className="text-xs text-gray-400">{claim.duration_hours.toFixed(1)}h disruption</span>
                      )}
                    </div>
                    <p className="text-gray-700 mt-1 text-sm">{claim.llm_explanation}</p>
                    <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                      <p>{new Date(claim.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      {claim.event_started_at && (
                        <p>Event: {new Date(claim.event_started_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          {claim.event_ended_at ? ` → ${new Date(claim.event_ended_at).toLocaleString('en-IN', { timeStyle: 'short' })}` : ' (ongoing)'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <span className="font-bold text-blue-700 text-lg">₹{claim.payout_amount?.toFixed(0)}</span>
                    {active_policy && (
                      <p className="text-xs text-gray-400">of ₹{active_policy.coverage_amount?.toFixed(0)} max</p>
                    )}
                  </div>
                </div>
                {claim.status === 'PAID' && !claim.trust_survey_response && (
                  <button
                    onClick={() => setSurveyClaimId(claim.id)}
                    className="text-xs text-blue-600 underline mt-2"
                  >
                    Rate this payout
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-1">{new Date(claim.created_at).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Worker info */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Your Profile</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Platform</span><p className="font-medium">{displayWorker?.platform}</p></div>
            <div><span className="text-gray-500">UPI ID</span><p className="font-medium">{displayWorker?.upi_id}</p></div>
            <div><span className="text-gray-500">Trust Tier</span><p className="font-medium">{displayWorker?.trust_tier?.replace(/_/g, ' ')}</p></div>
            <div><span className="text-gray-500">Tenure</span><p className="font-medium">{displayWorker?.tenure_weeks} weeks</p></div>
          </div>
        </div>
      </div>

      {/* Survey Modal */}
      {surveyClaimId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold">Rate this payout</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={survey.understood_reason}
                  onChange={e => setSurvey(s => ({ ...s, understood_reason: e.target.checked }))} />
                Mujhe samajh aaya kyun payout mila
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={survey.payout_correct}
                  onChange={e => setSurvey(s => ({ ...s, payout_correct: e.target.checked }))} />
                Payout amount sahi laga
              </label>
              <div>
                <label className="text-sm text-gray-600">Trust score (1–5)</label>
                <div className="flex gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n}
                      onClick={() => setSurvey(s => ({ ...s, trust_score: n }))}
                      className={`w-9 h-9 rounded-full text-sm font-medium
                        ${survey.trust_score === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >{n}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSurveyClaimId(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSurveySubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
