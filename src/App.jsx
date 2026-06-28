import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import MainLayout from './layouts/MainLayout.jsx'
import {
  AdminDashboardPage,
  AdminDocumentsPage,
  AdminResearchDashboardPage,
  AdminUsersPage,
} from './pages/admin/AdminPages.jsx'
import { AdminTestSetPage } from './pages/admin/AdminTestSetPage.jsx'
import DocumentDetailPage from './pages/DocumentDetailPage.jsx'
import LibraryPage from './pages/LibraryPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'
import CourseManagementPage from './pages/admin/CourseManagementPage.jsx'
import {
  getDefaultRouteForUser,
  getSavedUser,
  isAdminSession,
  isAuthenticated,
} from './services/authService.js'

function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<PublicOnly><LoginPage /></PublicOnly>} path="/login" />
      <Route element={<PublicOnly><RegisterPage /></PublicOnly>} path="/register" />
      <Route element={<RequireAuth><SettingsPage /></RequireAuth>} path="/settings" />
      <Route element={<RequireAuth><SettingsPage /></RequireAuth>} path="/profile" />
      <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>} path="/admin">
        <Route index element={<Navigate replace to="/admin/dashboard" />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="documents" element={<AdminDocumentsPage />} />
        <Route path="courses" element={<CourseManagementPage />} />
        <Route path="subjects" element={<Navigate replace to="/admin/courses" />} />
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
  )
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

export default App
