function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a className="text-lg font-semibold tracking-tight" href="/">
            SWP
          </a>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <a className="transition hover:text-slate-950" href="/">
              Home
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

export default MainLayout
