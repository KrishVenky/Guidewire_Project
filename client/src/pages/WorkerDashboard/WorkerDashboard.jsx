import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import {
  getWorkerDashboard,
  submitSurvey,
  pausePolicy,
  updatePolicy,
  createPolicy,
  getWorkerPolicies,
  getClaimTimeline,
  getClaimEvidenceReceipt,
  getPolicyConsentReceipt,
  getCommunicationPreferences,
  updateCommunicationPreferences,
} from '../../api'

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
  const [selectedClaimTimeline, setSelectedClaimTimeline] = useState(null)
  const [claimTimeline, setClaimTimeline] = useState(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [prefs, setPrefs] = useState(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState('')
  const [prefsError, setPrefsError] = useState('')

  useEffect(() => {
    if (!workerId) { navigate('/'); return }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [workerId])

  const load = async () => {
    try {
      const [dashboardRes, policiesRes] = await Promise.all([
        getWorkerDashboard(workerId),
        getWorkerPolicies(workerId),
      ])
      const prefsRes = await getCommunicationPreferences(workerId)

      const dashboardData = dashboardRes.data
      const fallbackPolicy = (policiesRes.data || []).find((p) => p.status === 'PAUSED')
      const policyForView = dashboardData.active_policy || fallbackPolicy || null

      setData({
        ...dashboardData,
        active_policy: policyForView,
      })
      setPrefs(prefsRes.data)
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
      // 409 means a policy already exists (e.g. paused) — reload and let user resume.
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

  const openClaimTimeline = async (claimId) => {
    setSelectedClaimTimeline(claimId)
    setTimelineLoading(true)
    setClaimTimeline(null)
    try {
      const res = await getClaimTimeline(claimId)
      setClaimTimeline(res.data)
    } catch (e) {
      setClaimTimeline({ error: e?.response?.data?.detail || 'Could not load timeline' })
    } finally {
      setTimelineLoading(false)
    }
  }

  const handleSavePrefs = async () => {
    if (!prefs) return
    setPrefsError('')
    setPrefsMessage('')
    setPrefsSaving(true)
    try {
      const res = await updateCommunicationPreferences(workerId, prefs)
      setPrefs(res.data)
      setPrefsMessage('Communication preferences saved')
    } catch (e) {
      setPrefsError(e?.response?.data?.detail || 'Could not save preferences')
    } finally {
      setPrefsSaving(false)
    }
  }

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const downloadJson = (filename, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPolicyReceipt = async () => {
    if (!active_policy?.id) return
    const res = await getPolicyConsentReceipt(active_policy.id)
    downloadJson(`policy-consent-${active_policy.id}.json`, res.data)
  }

  const handleDownloadClaimReceipt = async (claimId) => {
    const res = await getClaimEvidenceReceipt(claimId)
    downloadJson(`claim-evidence-${claimId}.json`, res.data)
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
      <nav className="bg-blue-900 text-white px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
        <div className="min-w-0">
          <span className="text-xl font-bold">Hermetical</span>
          <span className="ml-3 text-blue-300 text-xs sm:text-sm">{displayWorker?.trust_tier?.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {displayWorker?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-blue-200 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{displayWorker?.full_name}</span>
          </div>
          <button onClick={() => { logout(); navigate('/') }}
            className="text-blue-300 hover:text-white text-sm underline">Logout</button>
        </div>
      </nav>

      {error && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-700 text-sm text-center py-2">{error}</div>
      )}

      <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
          {[
            ['coverage', 'Coverage'],
            ['claims', 'Claims'],
            ['receipts', 'Receipts'],
            ['preferences', 'Preferences'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4">

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
        <div id="coverage" className="bg-white rounded-xl shadow p-4 sm:p-5">
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
          {active_policy?.consent_receipt_hash && (
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-500 break-all">
                Consent receipt: <span className="font-mono">{active_policy.consent_receipt_hash}</span>
              </div>
              <button onClick={handleDownloadPolicyReceipt} className="text-xs text-blue-600 underline">
                Download consent receipt
              </button>
            </div>
          )}
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
        <div id="claims" className="bg-white rounded-xl shadow p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Claims</h2>
          {recent_claims?.length === 0 && (
            <p className="text-gray-400 text-sm">No claims yet. When a disruption hits your zone, claims appear here automatically.</p>
          )}
          <div className="space-y-3">
            {recent_claims?.map(claim => (
              <div
                key={claim.id}
                className={`border border-gray-100 rounded-lg p-3 transition-all duration-300 ${
                  claim.status === 'PAID'
                    ? 'claim-paid'
                    : claim.status === 'AUTO_APPROVED'
                      ? 'claim-triggered'
                      : ''
                }`}
              >
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
                {claim.evidence_receipt_hash && (
                  <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-gray-500 break-all">
                      Evidence receipt: <span className="font-mono">{claim.evidence_receipt_hash}</span>
                    </span>
                    <button
                      onClick={() => handleDownloadClaimReceipt(claim.id)}
                      className="text-xs text-blue-600 underline"
                    >
                      Download evidence receipt
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => openClaimTimeline(claim.id)}
                    className="text-xs text-blue-600 underline"
                  >
                    View timeline
                  </button>
                  {selectedClaimTimeline === claim.id && timelineLoading && (
                    <span className="text-xs text-gray-400">Loading timeline...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Worker info */}
        <div className="bg-white rounded-xl shadow p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Your Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Platform</span><p className="font-medium">{displayWorker?.platform}</p></div>
            <div><span className="text-gray-500">UPI ID</span><p className="font-medium">{displayWorker?.upi_id}</p></div>
            <div><span className="text-gray-500">Trust Tier</span><p className="font-medium">{displayWorker?.trust_tier?.replace(/_/g, ' ')}</p></div>
            <div><span className="text-gray-500">Tenure</span><p className="font-medium">{displayWorker?.tenure_weeks} weeks</p></div>
            <div><span className="text-gray-500">Language</span><p className="font-medium">{displayWorker?.preferred_language || 'en'}</p></div>
            <div><span className="text-gray-500">Alerts</span><p className="font-medium">{displayWorker?.proactive_alerts_opt_in ? 'On' : 'Off'}</p></div>
          </div>
        </div>

        <div id="receipts" className="bg-white rounded-xl shadow p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Receipts & Proof</h2>
            <span className="text-xs text-gray-400">Downloadable JSON</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Policy consent</p>
              <div className="mt-1 flex items-center justify-between gap-3 flex-wrap">
                <p className="font-mono text-xs text-gray-700 break-all">{active_policy?.consent_receipt_hash || 'Available after policy activation'}</p>
                {active_policy?.consent_receipt_hash && (
                  <button onClick={handleDownloadPolicyReceipt} className="text-xs text-blue-600 underline">Download</button>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Claim evidence</p>
              <p className="mt-1 text-gray-600 text-xs">Open any claim card above to view and download its evidence receipt.</p>
            </div>
          </div>
        </div>

        <div id="preferences" className="bg-white rounded-xl shadow p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Communication Preferences</h2>
            <span className="text-xs text-gray-400">Service center controls</span>
          </div>
          {prefs ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Preferred language</label>
                  <input
                    value={prefs.preferred_language || 'en'}
                    onChange={(e) => setPrefs((current) => ({ ...current, preferred_language: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 sm:pt-6">
                  {[
                    ['whatsapp_opt_in', 'WhatsApp'],
                    ['sms_opt_in', 'SMS'],
                    ['email_opt_in', 'Email'],
                    ['proactive_alerts_opt_in', 'Alerts'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={Boolean(prefs[key])}
                        onChange={(e) => setPrefs((current) => ({ ...current, [key]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Quiet hours start</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={prefs.quiet_hours_start ?? ''}
                    onChange={(e) => setPrefs((current) => ({ ...current, quiet_hours_start: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Quiet hours end</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={prefs.quiet_hours_end ?? ''}
                    onChange={(e) => setPrefs((current) => ({ ...current, quiet_hours_end: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSavePrefs}
                  disabled={prefsSaving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {prefsSaving ? 'Saving...' : 'Save preferences'}
                </button>
                {prefsMessage && <span className="text-xs text-green-700">{prefsMessage}</span>}
                {prefsError && <span className="text-xs text-red-600">{prefsError}</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Loading preferences...</p>
          )}
        </div>

        {selectedClaimTimeline && claimTimeline && !claimTimeline.error && (
          <div className="bg-white rounded-xl shadow p-4 sm:p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Claim Timeline</h2>
              <button onClick={() => { setSelectedClaimTimeline(null); setClaimTimeline(null) }} className="text-sm text-gray-500 underline">
                Close
              </button>
            </div>
            <div className="space-y-3">
              {claimTimeline.events.map((event) => (
                <div key={`${event.code}-${event.timestamp || 'na'}`} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-800">{event.label}</p>
                    <span className="text-xs text-gray-400">{event.timestamp ? new Date(event.timestamp).toLocaleString('en-IN') : 'Pending'}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{event.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedClaimTimeline && claimTimeline?.error && (
          <div className="bg-white rounded-xl shadow p-4 sm:p-5 border border-red-100 text-red-700 text-sm">
            {claimTimeline.error}
          </div>
        )}
      </div>

        <div className="sm:hidden fixed bottom-4 left-4 right-4 z-20">
          <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
            {[
              ['coverage', 'Cover'],
              ['claims', 'Claims'],
              ['receipts', 'Receipts'],
              ['preferences', 'Prefs'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="rounded-xl bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-700"
              >
                {label}
              </button>
            ))}
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
