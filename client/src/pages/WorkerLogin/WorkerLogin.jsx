import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestWorkerOtp, verifyWorkerOtp } from '../../api'
import { useStore } from '../../store'

const TRUST_POINTS = [
  'Fast OTP login with secure verification',
  'Claims, receipts, and preferences in one place',
  'Designed for quick access on mobile',
]

export default function WorkerLogin() {
  const navigate = useNavigate()
  const setWorkerAuth = useStore((s) => s.setWorkerAuth)

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [debugOtp, setDebugOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRequestOtp = async () => {
    setError('')
    const normalizedPhone = (phone || '').replace(/\D/g, '').slice(0, 10)
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setError('Enter a valid 10-digit mobile number')
      return
    }

    setLoading(true)
    try {
      const res = await requestWorkerOtp(normalizedPhone)
      setPhone(normalizedPhone)
      setOtpSent(true)
      setDebugOtp(res.data?.debug_otp || '')
    } catch (e) {
      if (e?.response?.status === 404) {
        setError('No account found for this number. Please register first.')
        return
      }
      setError(e?.response?.data?.detail || 'Could not send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError('')
    const cleanOtp = (otp || '').replace(/\D/g, '').slice(0, 6)
    if (cleanOtp.length !== 6) {
      setError('Enter a valid 6-digit OTP')
      return
    }

    setLoading(true)
    try {
      const res = await verifyWorkerOtp(phone, cleanOtp)
      const token = res.data?.access_token
      const worker = res.data?.worker
      if (!token || !worker?.id) {
        setError('Invalid login response from server')
        return
      }
      setWorkerAuth(worker.id, worker, token)
      navigate('/dashboard')
    } catch (e) {
      setError(e?.response?.data?.detail || 'OTP verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.25),_transparent_32%),linear-gradient(180deg,#081220_0%,#0f172a_45%,#f8fafc_45%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-[2rem] bg-slate-950 text-white shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_25%)]" />
          <div className="relative p-7 sm:p-10 lg:p-12 space-y-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.22em] text-blue-200 uppercase">
              Secure worker access
            </div>
            <div className="max-w-2xl space-y-4">
              <h1 className="text-4xl sm:text-5xl font-semibold leading-none tracking-tight">
                Sign in without friction.
                <span className="block text-blue-200">Get straight to coverage.</span>
              </h1>
              <p className="max-w-xl text-sm sm:text-base text-slate-300">
                A cleaner login flow inspired by insurer service portals: one field to start, one OTP to verify, and quick access to your claims and receipts after login.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {TRUST_POINTS.map((point) => (
                <div key={point} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 backdrop-blur">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="rounded-[2rem] bg-white p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="text-center mb-8 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-blue-700 font-semibold">Worker Login</p>
              <h2 className="text-3xl font-semibold text-slate-900">Access your dashboard</h2>
              <p className="text-sm text-slate-500">Use your mobile number and a 6-digit OTP.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mobile number</label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(e) => e.key === 'Enter' && !otpSent && handleRequestOtp()}
                  disabled={otpSent}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg tracking-wide outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>

              {otpSent && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg tracking-[0.35em] outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>
              )}

              {otpSent && debugOtp && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Demo OTP: <span className="font-semibold tracking-[0.35em]">{debugOtp}</span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={otpSent ? handleVerifyOtp : handleRequestOtp}
                disabled={loading}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? 'Please wait...' : otpSent ? 'Verify OTP' : 'Send OTP'}
              </button>

              {otpSent && (
                <button
                  onClick={() => { setOtpSent(false); setOtp(''); setDebugOtp(''); setError('') }}
                  disabled={loading}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Change number
                </button>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 text-sm">
                <button onClick={() => navigate('/worker/register')} className="text-blue-700 underline underline-offset-4">
                  New user? Register
                </button>
                <button onClick={() => navigate('/')} className="text-slate-500 underline underline-offset-4">
                  Back to home
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
