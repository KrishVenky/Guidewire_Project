import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set) => ({
      workerId: null,
      workerData: null,
      isAdmin: false,
      setWorker: (id, data) => set({ workerId: id, workerData: data }),
      setAdmin: (val) => set({ isAdmin: val }),
      logout: () => set({ workerId: null, workerData: null, isAdmin: false }),
    }),
    { name: 'rainready-store', partialize: (state) => ({ workerId: state.workerId, workerData: state.workerData }) }
  )
)
