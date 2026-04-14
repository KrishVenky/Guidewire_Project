import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestWorkerOtp, verifyWorkerOtp } from '../../api'
import { useStore } from '../../store'

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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">Worker Login</h1>
          <p className="text-gray-500 text-sm mt-1">Access your Hermetical dashboard</p>
        </div>

        <div className="space-y-4">
          <input
            type="tel"
            maxLength={10}
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={(e) => e.key === 'Enter' && !otpSent && handleRequestOtp()}
            disabled={otpSent}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {otpSent && (
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {otpSent && debugOtp && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 text-sm">
              Demo OTP: <span className="font-semibold tracking-widest">{debugOtp}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={otpSent ? handleVerifyOtp : handleRequestOtp}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Please wait...' : otpSent ? 'Verify OTP' : 'Send OTP'}
          </button>

          {otpSent && (
            <button
              onClick={() => { setOtpSent(false); setOtp(''); setDebugOtp(''); setError('') }}
              disabled={loading}
              className="w-full border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
            >
              Change Number
            </button>
          )}

          <div className="text-center text-sm space-y-1">
            <button onClick={() => navigate('/worker/register')} className="text-blue-600 underline">
              New user? Register here
            </button>
            <div>
              <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 underline">
                Back to home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
