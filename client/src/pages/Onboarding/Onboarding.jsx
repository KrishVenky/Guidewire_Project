import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { lookupWorkerByPhone, registerWorker, getZones, calculatePremium, createPolicy } from '../../api'
import { useStore } from '../../store'

const PLATFORMS = ['ZOMATO', 'SWIGGY', 'BLINKIT', 'INSTAMART', 'MULTIPLE']

// step -1 = phone entry (login or register decision)
// step 0..4 = registration steps for new users
const REG_STEPS = ['Details', 'Income & UPI', 'Premium Preview', 'Done']

export default function Onboarding() {
  const navigate = useNavigate()
  const setWorker = useStore((s) => s.setWorker)

  const [mode, setMode] = useState('phone') // 'phone' | 'register'
  const [step, setStep] = useState(0) // used only in register mode
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [phone, setPhone] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    platform: 'ZOMATO',
    zone_id: '',
    upi_id: '',
    avg_weekly_income: 3500,
    declared_weekly_hours: 48,
  })

  const [workerId, setWorkerId] = useState(null)
  const [premium, setPremium] = useState(null)

  useEffect(() => {
    getZones().then((r) => setZones(r.data)).catch(() => {})
  }, [])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // ── Phone screen: check if existing user ──
  const handlePhoneContinue = async () => {
    setError('')
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await lookupWorkerByPhone(phone)
      // Existing user — log them in directly
      const w = res.data
      setWorker(w.id, w)
      navigate('/dashboard')
    } catch (e) {
      if (e?.response?.status === 404) {
        // New user — proceed to registration
        setMode('register')
        setStep(0)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Registration steps ──
  const next = async () => {
    setError('')
    setLoading(true)
    try {
      if (step === 0) {
        // Details
        if (!form.full_name.trim()) throw new Error('Name is required')
        if (!form.zone_id) throw new Error('Please select your delivery zone')
        setStep(1)
      } else if (step === 1) {
        // Income & UPI — register worker
        if (!form.upi_id.includes('@')) throw new Error('Enter a valid UPI ID (e.g. name@upi)')
        const res = await registerWorker({ phone, ...form })
        const id = res.data.id
        setWorkerId(id)
        setWorker(id, res.data)
        const pRes = await calculatePremium(id)
        setPremium(pRes.data)
        setStep(2)
      } else if (step === 2) {
        // Activate policy
        await createPolicy(workerId)
        setStep(3)
      } else if (step === 3) {
        navigate('/dashboard')
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ── Phone screen ──
  if (mode === 'phone') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-900">RainReady</h1>
            <p className="text-gray-500 text-sm mt-1">Income insurance for delivery partners</p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Enter your mobile number</h2>
            <p className="text-gray-500 text-sm">
              Already registered? We'll log you in automatically.
            </p>
            <input
              type="tel"
              maxLength={10}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePhoneContinue()}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handlePhoneContinue}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>

            <p className="text-center text-sm">
              <button
                onClick={() => navigate('/')}
                className="text-gray-400 hover:text-gray-600 underline"
              >
                Back to home
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration flow ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-900">RainReady</h1>
          <p className="text-gray-500 text-sm mt-1">New account — {phone}</p>
        </div>

        {/* Step indicator */}
        <div className="flex justify-between mb-8">
          {REG_STEPS.map((s, i) => (
            <div key={s} className="flex flex-col items-center flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-xs text-gray-400 mt-1 hidden sm:block">{s}</span>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {/* Step 0 — Details */}
          {step === 0 && (
            <>
              <h2 className="text-xl font-semibold text-gray-800">Your details</h2>
              <input
                placeholder="Full name"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={form.platform}
                onChange={(e) => update('platform', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <select
                value={form.zone_id}
                onChange={(e) => update('zone_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select your delivery zone</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}, {z.city}</option>)}
              </select>
            </>
          )}

          {/* Step 1 — Income & UPI */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-gray-800">Income & UPI</h2>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Average weekly income (₹)</label>
                <input
                  type="number"
                  value={form.avg_weekly_income}
                  onChange={(e) => update('avg_weekly_income', parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Hours worked per week</label>
                <input
                  type="number"
                  value={form.declared_weekly_hours}
                  onChange={(e) => update('declared_weekly_hours', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">UPI ID</label>
                <input
                  placeholder="yourname@upi"
                  value={form.upi_id}
                  onChange={(e) => update('upi_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Step 2 — Premium Preview */}
          {step === 2 && premium && (
            <>
              <h2 className="text-xl font-semibold text-gray-800">Your coverage plan</h2>
              <div className="bg-blue-50 rounded-xl p-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Weekly premium</span>
                  <span className="font-bold text-blue-700 text-lg">₹{premium.weekly_premium.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max payout per event</span>
                  <span className="font-semibold">₹{premium.coverage_amount.toFixed(2)}</span>
                </div>
                <hr className="border-blue-200" />
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Zone risk multiplier</span><span>{premium.zone_multiplier}×</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Season factor</span><span>{premium.season_factor}×</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tenure discount</span><span>{premium.tenure_discount}×</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 text-center">
                Payout lands in your UPI automatically. No forms, no waiting.
              </p>
            </>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-bold text-green-600">You're covered!</h2>
              <p className="text-gray-600">
                RainReady is watching your zone. When baarish, garmi, ya bandh hits —
                payout automatically tera UPI mein aayega.
              </p>
              <div className="bg-green-50 rounded-lg p-4 text-sm text-green-800">
                Premium deducted every Monday. Payouts within minutes of a verified disruption.
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {step > 0 && step <= 1 && (
              <button
                onClick={() => { setError(''); setStep(step - 1) }}
                disabled={loading}
                className="w-1/3 border border-gray-300 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            {step === 0 && (
              <button
                onClick={() => { setError(''); setMode('phone') }}
                disabled={loading}
                className="w-1/3 border border-gray-300 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading
                ? 'Please wait...'
                : step === 3
                  ? 'Go to Dashboard'
                  : step === 2
                    ? `Activate Coverage — ₹${premium?.weekly_premium?.toFixed(2)}/week`
                    : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
