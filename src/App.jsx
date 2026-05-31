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
  AdminExperimentsPage,
  AdminIndexingPage,
  AdminLogsPage,
  AdminModelSettingsPage,
  AdminResearchDashboardPage,
  AdminSubjectsPage,
  AdminTestSetPage,
  AdminUsersPage,
} from './pages/admin/AdminPages.jsx'
import DocumentDetailPage from './pages/DocumentDetailPage.jsx'
import LibraryPage from './pages/LibraryPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />
      <Route element={<SettingsPage />} path="/settings" />
      <Route element={<SettingsPage />} path="/profile" />
      <Route element={<AdminLayout />} path="/admin">
        <Route index element={<Navigate replace to="/admin/dashboard" />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="documents" element={<AdminDocumentsPage />} />
        <Route path="subjects" element={<AdminSubjectsPage />} />
        <Route path="indexing" element={<AdminIndexingPage />} />
        <Route path="model-settings" element={<AdminModelSettingsPage />} />
        <Route path="test-set" element={<AdminTestSetPage />} />
        <Route path="experiments" element={<AdminExperimentsPage />} />
        <Route path="research-dashboard" element={<AdminResearchDashboardPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
      </Route>
      <Route element={<MainLayout />}>
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

export default App
