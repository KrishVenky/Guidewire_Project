import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set) => ({
      workerId: null,
      workerData: null,
      workerToken: null,
      isAdmin: false,
      adminToken: null,
      setWorker: (id, data) => set({ workerId: id, workerData: data }),
      setWorkerAuth: (id, data, token) => set({ workerId: id, workerData: data, workerToken: token }),
      setAdmin: (val) => set({ isAdmin: val }),
      setAdminAuth: (token) => set({ isAdmin: true, adminToken: token }),
      logout: () => set({ workerId: null, workerData: null, workerToken: null, isAdmin: false, adminToken: null }),
    }),
    {
      name: 'rainready-store',
      partialize: (state) => ({
        workerId: state.workerId,
        workerData: state.workerData,
        workerToken: state.workerToken,
        isAdmin: state.isAdmin,
        adminToken: state.adminToken,
      }),
    }
  )
)
