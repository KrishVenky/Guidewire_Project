import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Home from './pages/Home/Home'
import Onboarding from './pages/Onboarding/Onboarding'
import WorkerLogin from './pages/WorkerLogin/WorkerLogin'
import WorkerDashboard from './pages/WorkerDashboard/WorkerDashboard'
import AdminDashboard from './pages/AdminDashboard/AdminDashboard'

function ProtectedWorker({ children }) {
  const { workerId, workerToken } = useStore()
  return workerId && workerToken ? children : <Navigate to="/worker/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/worker/login" element={<WorkerLogin />} />
        <Route path="/worker/register" element={<Onboarding />} />
        <Route path="/onboarding" element={<Navigate to="/worker/register" replace />} />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedWorker>
              <WorkerDashboard />
            </ProtectedWorker>
          }
        />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
