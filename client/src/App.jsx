import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Onboarding from './pages/Onboarding/Onboarding'
import WorkerDashboard from './pages/WorkerDashboard/WorkerDashboard'
import AdminDashboard from './pages/AdminDashboard/AdminDashboard'

function ProtectedWorker({ children }) {
  const { workerId } = useStore()
  return workerId ? children : <Navigate to="/onboarding" replace />
}

function ProtectedAdmin({ children }) {
  const { isAdmin } = useStore()
  return isAdmin ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
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
