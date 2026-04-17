import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import {
  createPolicy,
  fileClaim,
  getClaimEvidenceReceipt,
  getClaimTimeline,
  getCommunicationPreferences,
  getPolicyConsentReceipt,
  getWorkerDashboard,
  getWorkerPolicies,
  pausePolicy,
  submitSurvey,
  updateCommunicationPreferences,
  updatePolicy,
} from '../../api'

const STATUS_COLORS = {
  AUTO_APPROVED: 'bg-emerald-100 text-emerald-800',
  MANUAL_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  REJECTED: 'bg-rose-100 text-rose-800',
}

const DISRUPTION_META = {
  HEAVY_RAIN: { label: 'Heavy Rain', tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  EXTREME_HEAT: { label: 'Extreme Heat', tone: 'border-orange-200 bg-orange-50 text-orange-800' },
  HIGH_AQI: { label: 'High AQI', tone: 'border-violet-200 bg-violet-50 text-violet-800' },
  NDMA_ALERT: { label: 'NDMA Alert', tone: 'border-red-200 bg-red-50 text-red-800' },
  BANDH: { label: 'Bandh', tone: 'border-slate-300 bg-slate-100 text-slate-800' },
  ORDER_DROP: { label: 'Order Drop', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
}

const QUICK_JUMP_SECTIONS = [
  ['coverage', 'Coverage'],
  ['claims', 'Claims'],
  ['receipts', 'Receipts'],
  ['preferences', 'Preferences'],
]

function formatCurrency(value) {
  return `INR ${(value || 0).toFixed(2)}`
}

function formatDateTime(value) {
  if (!value) return 'Pending'
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function WorkerDashboard() {
  const navigate = useNavigate()
  const { workerId, workerData: cachedWorker, logout } = useStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [claimActionLoadingId, setClaimActionLoadingId] = useState(null)
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
    if (!workerId) {
      navigate('/')
      return
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [workerId])

  const load = async () => {
    try {
      const [dashboardRes, policiesRes, prefsRes] = await Promise.all([
        getWorkerDashboard(workerId),
        getWorkerPolicies(workerId),
        getCommunicationPreferences(workerId),
      ])

      const dashboardData = dashboardRes.data
      const fallbackPolicy = (policiesRes.data || []).find((policy) => policy.status === 'PAUSED')
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

  const resetActionFeedback = () => {
    setActionMessage('')
    setActionError('')
  }

  const handlePause = async () => {
    if (!data?.active_policy) return
    resetActionFeedback()
    await pausePolicy(data.active_policy.id)
    setActionMessage('Coverage paused.')
    load()
  }

  const handleResume = async () => {
    if (!data?.active_policy) return
    resetActionFeedback()
    await updatePolicy(data.active_policy.id, { status: 'ACTIVE' })
    setActionMessage('Coverage resumed.')
    load()
  }

  const handleGetCoverage = async () => {
    resetActionFeedback()
    try {
      await createPolicy(workerId)
      setActionMessage('Coverage activated successfully.')
    } catch (e) {
      if (e?.response?.status !== 409) {
        setActionError(e?.response?.data?.detail || 'Could not create policy')
        return
      }
      setActionMessage('An existing policy was found. Review it below.')
    }
    load()
  }

  const handleFileClaim = async (disruptionId) => {
    if (!workerId) return
    resetActionFeedback()
    setClaimActionLoadingId(disruptionId)
    try {
      const res = await fileClaim({ worker_id: workerId, disruption_event_id: disruptionId })
      const status = res?.data?.status?.replace(/_/g, ' ') || 'submitted'
      setActionMessage(`Payout claim filed successfully. Current status: ${status}.`)
      await load()
    } catch (e) {
      setActionError(e?.response?.data?.detail || 'Could not file this payout claim.')
    } finally {
      setClaimActionLoadingId(null)
    }
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
    if (!activePolicy?.id) return
    const res = await getPolicyConsentReceipt(activePolicy.id)
    downloadJson(`policy-consent-${activePolicy.id}.json`, res.data)
  }

  const handleDownloadClaimReceipt = async (claimId) => {
    const res = await getClaimEvidenceReceipt(claimId)
    downloadJson(`claim-evidence-${claimId}.json`, res.data)
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-slate-700 shadow-sm">
          Loading your dashboard...
        </div>
      </div>
    )
  }

  const {
    worker,
    operating_area: operatingArea,
    active_policy: activePolicy,
    recent_claims: recentClaims,
    active_disruptions: activeDisruptions,
    earnings_protected: earningsProtected,
  } = data || {}
  const displayWorker = worker || cachedWorker
  const canFileClaim = Boolean(activePolicy?.status === 'ACTIVE' && activeDisruptions?.length)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <nav className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Hermetical</p>
            <h1 className="text-xl font-semibold">Worker Claim Center</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 sm:block">
              {displayWorker?.trust_tier?.replace(/_/g, ' ') || 'Worker'}
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3">
          {QUICK_JUMP_SECTIONS.map(([id, label]) => (
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

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {(error || actionError || actionMessage) && (
          <div className="mb-4 space-y-2">
            {error && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}
            {actionError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {actionError}
              </div>
            )}
            {actionMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {actionMessage}
              </div>
            )}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-sky-800 p-6 text-white shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-sky-100">
                  Coverage, payout claims, and receipts in one place
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {displayWorker?.full_name || 'Worker'}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-sky-100 sm:text-base">
                    Track your protection, file a payout request when an active disruption hits your area,
                    and keep all evidence and communication preferences in one service dashboard.
                  </p>
                </div>
              </div>
              <div className="min-w-[180px] rounded-3xl border border-white/15 bg-white/10 p-4 text-sm text-sky-50">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Operating Area</p>
                <p className="mt-2 text-xl font-semibold">{operatingArea?.zone_name || 'Not set'}</p>
                <p className="text-sm text-sky-100">{operatingArea?.city || 'Bengaluru'}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-sky-200">Platform</p>
                    <p className="mt-1 font-semibold text-white">{displayWorker?.platform || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sky-200">Trust Tier</p>
                    <p className="mt-1 font-semibold text-white">
                      {displayWorker?.trust_tier?.replace(/_/g, ' ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Coverage</p>
                <p className="mt-2 text-2xl font-semibold">
                  {activePolicy ? formatCurrency(activePolicy.coverage_amount) : 'Inactive'}
                </p>
                <p className="mt-1 text-sm text-sky-100">
                  {activePolicy ? `Weekly premium ${formatCurrency(activePolicy.weekly_premium)}` : 'Activate a plan to stay protected.'}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Protected Income</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(earningsProtected)}</p>
                <p className="mt-1 text-sm text-sky-100">Total payout value credited through approved claims.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Live Disruptions</p>
                <p className="mt-2 text-2xl font-semibold">{activeDisruptions?.length || 0}</p>
                <p className="mt-1 text-sm text-sky-100">
                  {canFileClaim ? 'You can file a payout request below.' : 'No payout filing is currently open.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div id="coverage" className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Coverage</p>
                  <h3 className="mt-1 text-2xl font-semibold text-slate-900">
                    {activePolicy ? activePolicy.status : 'No active policy'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {activePolicy
                      ? `Premium ${formatCurrency(activePolicy.weekly_premium)} per week with a max payout of ${formatCurrency(activePolicy.coverage_amount)}.`
                      : 'Activate coverage to make yourself eligible for disruption-based payout claims.'}
                  </p>
                </div>
                {activePolicy ? (
                  <button
                    onClick={activePolicy.status === 'ACTIVE' ? handlePause : handleResume}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {activePolicy.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {!activePolicy && (
                  <button
                    onClick={handleGetCoverage}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Activate coverage
                  </button>
                )}
                {activePolicy?.consent_receipt_hash && (
                  <button
                    onClick={handleDownloadPolicyReceipt}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Download consent receipt
                  </button>
                )}
              </div>
              {activePolicy?.consent_receipt_hash && (
                <p className="mt-3 break-all text-xs text-slate-500">
                  Consent receipt hash: <span className="font-mono">{activePolicy.consent_receipt_hash}</span>
                </p>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Profile Snapshot</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">UPI ID</p>
                  <p className="mt-1 font-semibold text-slate-900">{displayWorker?.upi_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Language</p>
                  <p className="mt-1 font-semibold text-slate-900">{displayWorker?.preferred_language || 'en'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Tenure</p>
                  <p className="mt-1 font-semibold text-slate-900">{displayWorker?.tenure_weeks || 0} weeks</p>
                </div>
                <div>
                  <p className="text-slate-500">Alert Preference</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {displayWorker?.proactive_alerts_opt_in ? 'Enabled' : 'Muted'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Disruption Watch</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">
                {operatingArea?.zone_name || 'Your area'}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                File a payout claim only when there is an active eligible disruption in your operating area.
              </p>
            </div>
            {!activePolicy && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Activate coverage first to unlock payout filing.
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {activeDisruptions?.length ? (
              activeDisruptions.map((disruption) => {
                const hasClaimed = recentClaims?.some(c => c.disruption_event_id === disruption.id)
                const meta = DISRUPTION_META[disruption.event_type] || {
                  label: disruption.event_type.replace(/_/g, ' '),
                  tone: 'border-slate-200 bg-slate-50 text-slate-800',
                }

                return (
                  <div key={disruption.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                          {meta.label}
                        </span>
                        <h4 className="mt-3 text-lg font-semibold text-slate-900">
                          Severity {Math.round(disruption.severity_score)}/100
                        </h4>
                        <p className="mt-1 text-sm text-slate-600">
                          Started {formatDateTime(disruption.started_at)}
                        </p>
                      </div>
                      {hasClaimed ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Payout Claimed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleFileClaim(disruption.id)}
                          disabled={!activePolicy || activePolicy.status !== 'ACTIVE' || claimActionLoadingId === disruption.id}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {claimActionLoadingId === disruption.id ? 'Filing...' : 'File payout claim'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No active eligible disruptions are open in your operating area right now.
              </div>
            )}
          </div>
        </section>

        <section id="claims" className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Claims</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Recent payout requests</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {recentClaims?.length || 0} visible
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {recentClaims?.length ? (
              recentClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[claim.status] || 'bg-slate-100 text-slate-700'}`}>
                          {claim.status.replace(/_/g, ' ')}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                          {claim.auto_initiated ? 'Auto filed' : 'Filed by worker'}
                        </span>
                        {claim.duration_hours > 0 && (
                          <span className="text-xs text-slate-500">{claim.duration_hours.toFixed(1)}h disruption</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{claim.llm_explanation}</p>
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p>Created: {formatDateTime(claim.created_at)}</p>
                        {claim.event_started_at && (
                          <p>
                            Event window: {formatDateTime(claim.event_started_at)}
                            {claim.event_ended_at ? ` to ${formatDateTime(claim.event_ended_at)}` : ' (ongoing)'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="min-w-[160px] rounded-2xl bg-white p-4 text-right shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Payout</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {formatCurrency(claim.payout_amount || 0)}
                      </p>
                      {activePolicy && (
                        <p className="mt-1 text-xs text-slate-500">
                          Max cover {formatCurrency(activePolicy.coverage_amount || 0)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => openClaimTimeline(claim.id)}
                        className="text-sm font-medium text-blue-700 underline"
                      >
                        View timeline
                      </button>
                      {claim.evidence_receipt_hash && (
                        <button
                          onClick={() => handleDownloadClaimReceipt(claim.id)}
                          className="text-sm font-medium text-blue-700 underline"
                        >
                          Download evidence receipt
                        </button>
                      )}
                      {claim.status === 'PAID' && !claim.trust_survey_response && (
                        <button
                          onClick={() => setSurveyClaimId(claim.id)}
                          className="text-sm font-medium text-blue-700 underline"
                        >
                          Rate this payout
                        </button>
                      )}
                    </div>
                    {claim.evidence_receipt_hash && (
                      <p className="break-all text-xs text-slate-500">
                        Receipt hash: <span className="font-mono">{claim.evidence_receipt_hash}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No claims yet. When your area has an active disruption, you can file a payout request from the disruption panel above.
              </div>
            )}
          </div>
        </section>

        <section id="receipts" className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts and Proof</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Downloadable records</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">JSON exports</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Policy consent</p>
              <p className="mt-3 break-all text-sm text-slate-700">
                {activePolicy?.consent_receipt_hash || 'Available after policy activation'}
              </p>
              {activePolicy?.consent_receipt_hash && (
                <button onClick={handleDownloadPolicyReceipt} className="mt-4 text-sm font-medium text-blue-700 underline">
                  Download consent receipt
                </button>
              )}
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Claim evidence</p>
              <p className="mt-3 text-sm text-slate-600">
                Each payout request stores an evidence receipt hash. Open any claim above to download its claim decision evidence.
              </p>
            </div>
          </div>
        </section>

        <section id="preferences" className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Communication Preferences</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Service center controls</h3>
            </div>
          </div>

          {prefs ? (
            <div className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Preferred language</label>
                  <input
                    value={prefs.preferred_language || 'en'}
                    onChange={(e) => setPrefs((current) => ({ ...current, preferred_language: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 md:pt-6">
                  {[
                    ['whatsapp_opt_in', 'WhatsApp'],
                    ['sms_opt_in', 'SMS'],
                    ['email_opt_in', 'Email'],
                    ['proactive_alerts_opt_in', 'Alerts'],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                    >
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
                  <label className="mb-1 block text-xs text-slate-500">Quiet hours start</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={prefs.quiet_hours_start ?? ''}
                    onChange={(e) =>
                      setPrefs((current) => ({
                        ...current,
                        quiet_hours_start: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Quiet hours end</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={prefs.quiet_hours_end ?? ''}
                    onChange={(e) =>
                      setPrefs((current) => ({
                        ...current,
                        quiet_hours_end: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSavePrefs}
                  disabled={prefsSaving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {prefsSaving ? 'Saving...' : 'Save preferences'}
                </button>
                {prefsMessage && <span className="text-xs text-emerald-700">{prefsMessage}</span>}
                {prefsError && <span className="text-xs text-rose-700">{prefsError}</span>}
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">Loading preferences...</p>
          )}
        </section>

        {selectedClaimTimeline && claimTimeline && !claimTimeline.error && (
          <section className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Claim Timeline</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">Progress for selected claim</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedClaimTimeline(null)
                  setClaimTimeline(null)
                }}
                className="text-sm font-medium text-slate-600 underline"
              >
                Close
              </button>
            </div>
            {timelineLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading timeline...</p>
            ) : (
              <div className="mt-5 space-y-3">
                {claimTimeline.events.map((event) => (
                  <div key={`${event.code}-${event.timestamp || 'na'}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{event.label}</p>
                      <span className="text-xs text-slate-500">{formatDateTime(event.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedClaimTimeline && claimTimeline?.error && (
          <section className="mt-6 rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
            {claimTimeline.error}
          </section>
        )}
      </main>

      <div className="fixed bottom-4 left-4 right-4 z-20 sm:hidden">
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
          {QUICK_JUMP_SECTIONS.map(([id, label]) => (
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

      {surveyClaimId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Rate this payout</h3>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={survey.understood_reason}
                  onChange={(e) => setSurvey((current) => ({ ...current, understood_reason: e.target.checked }))}
                />
                I understood why the payout was issued
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={survey.payout_correct}
                  onChange={(e) => setSurvey((current) => ({ ...current, payout_correct: e.target.checked }))}
                />
                The payout amount felt correct
              </label>
              <div>
                <label className="text-sm text-slate-600">Trust score (1 to 5)</label>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSurvey((current) => ({ ...current, trust_score: value }))}
                      className={`h-10 w-10 rounded-full text-sm font-semibold ${
                        survey.trust_score === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setSurveyClaimId(null)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSurveySubmit}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

