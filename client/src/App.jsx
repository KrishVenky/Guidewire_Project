import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Home from './pages/Home/Home'
import Onboarding from './pages/Onboarding/Onboarding'
import WorkerDashboard from './pages/WorkerDashboard/WorkerDashboard'
import AdminDashboard from './pages/AdminDashboard/AdminDashboard'

function ProtectedWorker({ children }) {
  const { workerId } = useStore()
  return workerId ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
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
