import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import MainLayout from './layouts/MainLayout.jsx'
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
import { UploadProgressPopup } from './components/UploadProgressPopup.jsx'
import {
  getDefaultRouteForUser,
  getSavedUser,
  hasRole,
  isAdminSession,
  isResearcherSession,
  isAuthenticated,
} from './services/authService.js'

function App() {
  const [, setAuthVersion] = useState(0)

  useEffect(() => {
    const handleUnauthorized = () => setAuthVersion((value) => value + 1)
    window.addEventListener('fstu:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('fstu:unauthorized', handleUnauthorized)
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
      <Route element={<RequireFlow5Role><AdminLayout /></RequireFlow5Role>} path="/admin">
        <Route index element={<AdminIndex />} />
        <Route path="dashboard" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
        <Route path="users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="documents" element={<RequireAdmin><AdminDocumentsPage /></RequireAdmin>} />
        <Route path="courses" element={<RequireAdmin><SemesterWorkspacePage /></RequireAdmin>} />
        <Route path="subjects" element={<RequireAdmin><Navigate replace to="/admin/courses" /></RequireAdmin>} />
        <Route path="test-set" element={<AdminTestSetPage />} />
        <Route path="research-dashboard" element={<AdminResearchDashboardPage />} />
        {/* Redirects: old standalone pages → unified Research Dashboard */}
        <Route path="indexing" element={<Navigate replace to="/admin/research-dashboard" />} />
        <Route path="model-settings" element={<Navigate replace to="/admin/research-dashboard" />} />
        <Route path="experiments" element={<Navigate replace to="/admin/research-dashboard" />} />
        <Route path="logs" element={<Navigate replace to="/admin/research-dashboard" />} />
      </Route>
      <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
        <Route element={<Navigate replace to="/workspace" />} path="/app" />
        <Route element={<WorkspacePage />} path="/workspace" />
        <Route element={<Navigate replace to="/workspace" />} path="/chat" />
        <Route element={<LibraryPage />} path="/library" />
        <Route element={<DocumentDetailPage />} path="/library/documents/:id" />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
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
  if (!isAuthenticated()) {
    return <Navigate replace to="/login" />
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

function RequireFlow5Role({ children }) {
  if (!isAuthenticated()) return <Navigate replace to="/login" />
  if (!isAdminSession() && !isResearcherSession()) return <Navigate replace to="/workspace" />
  return children
}

function AdminIndex() {
  return <Navigate replace to={hasRole(getSavedUser(), 'ADMIN') ? '/admin/dashboard' : '/admin/test-set'} />
}

export default App
