function HomePage() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          React + Vite + Tailwind
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Base frontend structure is ready. Start adding pages, components,
          API services, and shared utilities from the src folder.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            href="https://vite.dev"
            rel="noreferrer"
            target="_blank"
          >
            Vite Docs
          </a>
          <a
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            href="https://tailwindcss.com"
            rel="noreferrer"
            target="_blank"
          >
            Tailwind Docs
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Project folders
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>components - reusable UI</li>
          <li>pages - route-level screens</li>
          <li>layouts - shared page shells</li>
          <li>services - API clients</li>
          <li>hooks - custom React hooks</li>
        </ul>
      </div>
    </section>
  )
}

export default HomePage
