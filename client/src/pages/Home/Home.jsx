import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'

export default function Home() {
  const navigate = useNavigate()
  const { workerId } = useStore()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white space-y-2">
          <h1 className="text-4xl font-bold">RainReady</h1>
          <p className="text-blue-200 text-sm">Income insurance for delivery partners</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Delivery Partner</h2>
            <p className="text-gray-500 text-sm mb-3">Register or access your coverage dashboard</p>
            <button
              onClick={() => navigate(workerId ? '/dashboard' : '/onboarding')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {workerId ? 'Go to Dashboard' : 'Get Started'}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Admin</h2>
            <p className="text-gray-500 text-sm mb-3">Monitor claims, zones and disruptions</p>
            <button
              onClick={() => navigate('/admin')}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Admin Login
            </button>
          </div>
        </div>

        <p className="text-center text-blue-300 text-xs">
          Guidewire DEVTrails 2026 · PES University
        </p>
      </div>
    </div>
  )
}
