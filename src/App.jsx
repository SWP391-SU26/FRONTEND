import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import {
  AdminDashboardPage,
  AdminDocumentsPage,
  AdminUsersPage,
} from './pages/admin/AdminPages.jsx'
import { AdminResearchDashboardPage } from './pages/admin/AdminResearchDashboardPage.jsx'
import { AdminTestSetPage } from './pages/admin/AdminTestSetPage.jsx'
import DocumentDetailPage from './pages/DocumentDetailPage.jsx'
import LibraryPage from './pages/LibraryPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'
import SemesterWorkspacePage from './pages/admin/SemesterWorkspacePage.jsx'
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage.jsx'
import PaymentResultPage from './pages/PaymentResultPage.jsx'
import ProPlanPage from './pages/ProPlanPage.jsx'
import PaymentsPage from './pages/PaymentsPage.jsx'
import AdminPlansPage from './pages/admin/AdminPlansPage.jsx'
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage.jsx'
import { UploadProgressPopup } from './components/UploadProgressPopup.jsx'
import {
  getDefaultRouteForUser,
  getSavedUser,
  isAdminSession,
  isAuthenticated,
} from './services/authService.js'
import { resumeActiveUploads } from './services/uploadService.js'

function App() {
  const [, setAuthVersion] = useState(0)

  useEffect(() => {
    const handleUnauthorized = () => setAuthVersion((value) => value + 1)
    window.addEventListener('fstu:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('fstu:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    if (isAuthenticated()) {
      resumeActiveUploads()
    }
  }, [])

  return (
    <>
      <ScrollToTop />
      <UploadProgressPopup />
      <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<PublicOnly><LoginPage /></PublicOnly>} path="/login" />
      <Route element={<PublicOnly><RegisterPage /></PublicOnly>} path="/register" />
      <Route element={<PublicOnly><ResetPasswordPage /></PublicOnly>} path="/reset-password" />
      <Route element={<RequireAuth><SettingsPage /></RequireAuth>} path="/settings" />
      <Route element={<RequireAuth><SettingsPage /></RequireAuth>} path="/profile" />
      <Route element={<RequireAuth><ProPlanPage /></RequireAuth>} path="/pro" />
      <Route element={<RequireAuth><PaymentsPage /></RequireAuth>} path="/payments" />
      <Route element={<RequireAuth><PaymentResultPage /></RequireAuth>} path="/payment/result" />
      <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>} path="/admin">
        <Route index element={<AdminIndex />} />
        <Route path="dashboard" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
        <Route path="users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="documents" element={<RequireAdmin><AdminDocumentsPage /></RequireAdmin>} />
        <Route path="courses" element={<RequireAdmin><SemesterWorkspacePage /></RequireAdmin>} />
        <Route path="subjects" element={<RequireAdmin><Navigate replace to="/admin/courses" /></RequireAdmin>} />
        <Route path="test-set" element={<AdminTestSetPage />} />
        <Route path="research-dashboard" element={<AdminResearchDashboardPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="plans" element={<AdminPlansPage />} />
        <Route path="feedback" element={<AdminFeedbackPage />} />
        {/* Redirects: old standalone pages → unified Research Dashboard */}
        <Route path="indexing" element={<Navigate replace to="/admin/research-dashboard" />} />
        <Route path="model-settings" element={<Navigate replace to="/admin/research-dashboard" />} />
        <Route path="experiments" element={<Navigate replace to="/admin/research-dashboard" />} />
        <Route path="logs" element={<Navigate replace to="/admin/research-dashboard" />} />
      </Route>
      <Route element={<RequireAuth><WorkspacePage /></RequireAuth>} path="/workspace" />
      <Route element={<RequireAuth><Navigate replace to="/workspace" /></RequireAuth>} path="/chat" />
      <Route element={<RequireAuth><Navigate replace to="/workspace" /></RequireAuth>} path="/app" />
      <Route element={<RequireAuth><LibraryPage /></RequireAuth>} path="/library" />
      <Route element={<RequireAuth><DocumentDetailPage /></RequireAuth>} path="/library/documents/:id" />
      <Route element={<RequireAuth><NotFoundPage /></RequireAuth>} path="*" />
      </Routes>
    </>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    const resetScroll = () => window.scrollTo({ top: 0, left: 0 })
    resetScroll()
    const frameId = window.requestAnimationFrame(resetScroll)
    const timeoutIds = [0, 50, 250].map((delay) => window.setTimeout(resetScroll, delay))
    return () => {
      window.cancelAnimationFrame(frameId)
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [pathname])

  return null
}

function PublicOnly({ children }) {
  if (isAuthenticated()) {
    return <Navigate replace to={getDefaultRouteForUser(getSavedUser())} />
  }

  return children
}

function RequireAuth({ children }) {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate replace state={{ returnTo: `${location.pathname}${location.search}` }} to="/login" />
  }

  return children
}

function RequireAdmin({ children }) {
  if (!isAuthenticated()) {
    return <Navigate replace to="/login" />
  }

  if (!isAdminSession()) {
    return <Navigate replace to="/workspace" />
  }

  return children
}

function AdminIndex() {
  return <Navigate replace to="/admin/dashboard" />
}

export default App
