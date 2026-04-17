import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicZones, registerWorker } from '../../api'

const PLATFORMS = ['ZOMATO', 'SWIGGY', 'BLINKIT', 'INSTAMART', 'MULTIPLE']

const STEPS = ['Account', 'Details', 'Done']

const BENEFITS = [
  'Fast setup in a few minutes',
  'Claims and receipts in one dashboard',
  'Service-center style support controls',
]

export default function Onboarding() {
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registeredPhone, setRegisteredPhone] = useState('')

  const [form, setForm] = useState({
    phone: '',
    full_name: '',
    platform: 'ZOMATO',
    zone_id: '',
    upi_id: '',
    avg_weekly_income: 3500,
    declared_weekly_hours: 48,
  })

  useEffect(() => {
    getPublicZones().then((r) => setZones(r.data)).catch(() => {})
  }, [])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const next = async () => {
    setError('')
    setLoading(true)
    try {
      if (step === 0) {
        const phone = (form.phone || '').replace(/\D/g, '').slice(0, 10)
        if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit mobile number')
        update('phone', phone)
        setStep(1)
      } else if (step === 1) {
        if (!form.full_name.trim()) throw new Error('Name is required')
        if (!form.zone_id) throw new Error('Please select your delivery zone')
        if (!form.upi_id.includes('@')) throw new Error('Enter a valid UPI ID (e.g. name@upi)')

        await registerWorker({
          phone: form.phone,
          full_name: form.full_name,
          platform: form.platform,
          zone_id: form.zone_id,
          upi_id: form.upi_id,
          avg_weekly_income: Number(form.avg_weekly_income),
          declared_weekly_hours: Number(form.declared_weekly_hours),
        })

        setRegisteredPhone(form.phone)
        setStep(2)
      } else if (step === 2) {
        navigate('/worker/login')
      }
    } catch (e) {
      if (e?.response?.status === 409) {
        setError('Phone already registered. Please use Worker Login.')
      } else {
        setError(e?.response?.data?.detail || e.message || 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_30%),linear-gradient(180deg,#081220_0%,#0f172a_40%,#f8fafc_40%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-12">
        <section className="lg:col-span-5 rounded-[2rem] bg-slate-950 text-white shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.16),transparent_24%)]" />
          <div className="relative p-7 sm:p-10 lg:p-12 space-y-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.22em] text-blue-200 uppercase">
              Worker onboarding
            </div>
            <div className="space-y-4 max-w-xl">
              <h1 className="text-4xl sm:text-5xl font-semibold leading-none tracking-tight">
                Create your profile.
                <span className="block text-blue-200">Start coverage faster.</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-lg">
                A guided sign-up flow inspired by insurer quote and onboarding journeys: simple steps, clear progress, and the important details grouped together.
              </p>
            </div>

            <div className="space-y-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 backdrop-blur">
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 rounded-[2rem] bg-white shadow-2xl border border-slate-100 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-blue-700 font-semibold">Worker Registration</p>
              <h2 className="text-3xl font-semibold text-slate-900">Create your account</h2>
            </div>
            <button onClick={() => navigate('/worker/login')} className="text-sm text-blue-700 underline underline-offset-4 self-start sm:self-auto">
              Already registered? Login
            </button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex xl:flex-col gap-3 xl:gap-4 overflow-x-auto xl:overflow-visible pb-1 xl:pb-0">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-3 xl:items-start xl:gap-0 xl:flex-col min-w-[88px] xl:min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                        ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                      {i < step ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${i === step ? 'text-slate-900' : 'text-slate-500'} xl:mt-2`}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              {step === 0 && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Mobile number</h3>
                    <p className="text-sm text-slate-500">We’ll use this to verify your account.</p>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg tracking-wide outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1">
                    <h3 className="text-xl font-semibold text-slate-900">Your details</h3>
                    <p className="text-sm text-slate-500">Add the information needed to calculate coverage and set up payouts.</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 block mb-2">Full name</label>
                    <input
                      placeholder="Full name"
                      value={form.full_name}
                      onChange={(e) => update('full_name', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 block mb-2">Platform</label>
                    <select
                      value={form.platform}
                      onChange={(e) => update('platform', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                    >
                      {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 block mb-2">Zone</label>
                    <select
                      value={form.zone_id}
                      onChange={(e) => update('zone_id', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                    >
                      <option value="">Select your delivery zone</option>
                      {zones.map((z) => <option key={z.id} value={z.id}>{z.name}, {z.city}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 block mb-2">Average weekly income (₹)</label>
                    <input
                      type="number"
                      value={form.avg_weekly_income}
                      onChange={(e) => update('avg_weekly_income', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 block mb-2">Hours per week</label>
                    <input
                      type="number"
                      value={form.declared_weekly_hours}
                      onChange={(e) => update('declared_weekly_hours', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 block mb-2">UPI ID</label>
                    <input
                      placeholder="yourname@upi"
                      value={form.upi_id}
                      onChange={(e) => update('upi_id', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
                  <div className="text-5xl">✅</div>
                  <h3 className="text-2xl font-semibold text-emerald-700">Registration complete</h3>
                  <p className="text-slate-600">
                    Your account is ready for {registeredPhone}. Log in next to activate coverage and manage your dashboard.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {step > 0 && step < 2 && (
                  <button
                    onClick={() => { setError(''); setStep(step - 1) }}
                    disabled={loading}
                    className="sm:w-36 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back
                  </button>
                )}
                {step === 0 && (
                  <button
                    onClick={() => navigate('/')}
                    disabled={loading}
                    className="sm:w-36 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Home
                  </button>
                )}
                <button
                  onClick={next}
                  disabled={loading}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? 'Please wait...' : step === 2 ? 'Go to Login' : 'Continue'}
                </button>
              </div>

              {step < 2 && (
                <p className="text-center text-sm text-slate-500">
                  Already registered? <button onClick={() => navigate('/worker/login')} className="text-blue-700 underline underline-offset-4">Login here</button>
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
