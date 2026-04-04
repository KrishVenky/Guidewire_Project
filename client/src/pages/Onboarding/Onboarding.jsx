import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getZones, registerWorker } from '../../api'

const PLATFORMS = ['ZOMATO', 'SWIGGY', 'BLINKIT', 'INSTAMART', 'MULTIPLE']

const STEPS = ['Account', 'Details', 'Done']

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
    getZones().then((r) => setZones(r.data)).catch(() => {})
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-900">Worker Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Create your account first, then login to manage coverage</p>
        </div>

        <div className="flex justify-between mb-8">
          {STEPS.map((s, i) => (
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
          {step === 0 && (
            <>
              <h2 className="text-xl font-semibold text-gray-800">Mobile Number</h2>
              <input
                type="tel"
                maxLength={10}
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}

          {step === 1 && (
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
              <div>
                <label className="text-sm text-gray-600 block mb-1">Average weekly income (₹)</label>
                <input
                  type="number"
                  value={form.avg_weekly_income}
                  onChange={(e) => update('avg_weekly_income', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Hours worked per week</label>
                <input
                  type="number"
                  value={form.declared_weekly_hours}
                  onChange={(e) => update('declared_weekly_hours', e.target.value)}
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

          {step === 2 && (
            <div className="text-center space-y-4">
              <div className="text-6xl">✅</div>
              <h2 className="text-2xl font-bold text-green-600">Registration complete</h2>
              <p className="text-gray-600">
                Your account is ready for {registeredPhone}. Please login to access your dashboard and activate coverage.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {step > 0 && step < 2 && (
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
                onClick={() => navigate('/')}
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
              {loading ? 'Please wait...' : step === 2 ? 'Go to Login' : 'Continue'}
            </button>
          </div>

          {step < 2 && (
            <p className="text-center text-sm">
              Already registered?{' '}
              <button onClick={() => navigate('/worker/login')} className="text-blue-600 underline">
                Login here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
