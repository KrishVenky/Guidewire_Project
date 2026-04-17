import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'

const QUICK_ACTIONS = [
  {
    title: 'Worker Login',
    description: 'Go to claims, coverage, receipts, and preferences.',
    path: '/worker/login',
    accent: 'from-blue-600 to-blue-700',
  },
  {
    title: 'Register Worker',
    description: 'Create a new delivery-partner profile in minutes.',
    path: '/worker/register',
    accent: 'from-slate-900 to-slate-700',
  },
  {
    title: 'Admin Console',
    description: 'Review claims, zones, and system health.',
    path: '/admin',
    accent: 'from-emerald-600 to-teal-600',
  },
]

const TRUST_POINTS = [
  'Claim timeline with clear status progression',
  'Downloadable consent and evidence receipts',
  'Channel preferences and quiet hours',
  'Fast access to service-center style actions',
]

const INSURER_STYLE_TILES = [
  {
    label: 'Claims',
    value: 'Track payouts and review evidence',
    note: 'Like insurer claim status pages',
  },
  {
    label: 'Service Center',
    value: 'Manage policies, alerts, and documents',
    note: 'Self-serve servicing pattern',
  },
  {
    label: 'Trust',
    value: 'Receipts, audit trails, and transparency',
    note: 'Built for judge confidence',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { workerId } = useStore()

  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/75 border-b border-white/60">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-700 font-semibold">Hermetical</p>
            <h1 className="text-xl sm:text-2xl font-semibold">Income insurance for delivery workers</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700">Claims</span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">Service Center</span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">Receipts</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <section className="grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 text-white p-7 sm:p-10 shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.28),transparent_25%)]" />
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
                Inspired by insurer service portals and claim centers
              </div>
              <div className="space-y-4 max-w-2xl">
                <h2 className="text-4xl sm:text-6xl leading-[0.95] font-semibold tracking-tight">
                  Simple navigation.
                  <span className="block text-blue-200">Faster claims.</span>
                  Clear receipts.
                </h2>
                <p className="text-blue-100/90 text-base sm:text-lg max-w-xl">
                  A more usable dashboard for delivery partners: claim tracking, policy control, alert preferences,
                  and downloadable proof in one place.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {INSURER_STYLE_TILES.map((tile) => (
                  <div key={tile.label} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-blue-200/80">{tile.label}</p>
                    <p className="mt-2 text-sm font-semibold">{tile.value}</p>
                    <p className="mt-1 text-xs text-blue-100/70">{tile.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5 grid gap-4">
            <div className="rounded-[1.75rem] bg-white shadow-xl border border-slate-100 p-6 sm:p-7">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Quick access</p>
                  <h3 className="text-2xl font-semibold">Choose a path</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-slate-950 text-white grid place-items-center font-semibold">HR</div>
              </div>
              <div className="space-y-3">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.title}
                    onClick={() => navigate(action.path)}
                    className={`w-full text-left rounded-2xl p-4 text-white shadow-lg transition-transform hover:-translate-y-0.5 bg-gradient-to-r ${action.accent}`}
                  >
                    <p className="text-lg font-semibold">{action.title}</p>
                    <p className="mt-1 text-sm text-white/80">{action.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-white shadow-xl border border-slate-100 p-6 sm:p-7">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Why it feels easier</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="rounded-[1.5rem] bg-white p-5 shadow-lg border border-slate-100">
            <p className="text-sm text-slate-500">Current session</p>
            <p className="mt-1 text-2xl font-semibold">{workerId ? 'Worker already logged in' : 'Fresh visitor'}</p>
            <p className="mt-2 text-sm text-slate-600">Direct routing keeps the experience shallow and easy to scan.</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-lg border border-slate-100">
            <p className="text-sm text-slate-500">Worker flow</p>
            <p className="mt-1 text-2xl font-semibold">Login or register</p>
            <p className="mt-2 text-sm text-slate-600">Two obvious entry points, no hidden navigation layers.</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-lg border border-slate-100">
            <p className="text-sm text-slate-500">Admin flow</p>
            <p className="mt-1 text-2xl font-semibold">Review and simulate</p>
            <p className="mt-2 text-sm text-slate-600">A separate console for operations and actuarial experiments.</p>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/80 backdrop-blur p-6 sm:p-8 shadow-lg">
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-blue-700 font-semibold">Navigation map</p>
              <h3 className="mt-2 text-3xl font-semibold">One screen, three jobs</h3>
              <p className="mt-3 text-slate-600 max-w-prose">
                Most insurer portals separate buying, servicing, and claims very clearly. This home screen now does the same:
                workers, admins, and registration all get an obvious route with almost no decision fatigue.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Claim', text: 'Track, review, download' },
                { label: 'Policy', text: 'Activate, pause, receipts' },
                { label: 'Support', text: 'Preferences and service center' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
