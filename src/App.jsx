import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import AdminDashboardPage from './pages/AdminDashboardPage.jsx'
import DocumentDetailPage from './pages/DocumentDetailPage.jsx'
import LibraryPage from './pages/LibraryPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />
      <Route element={<WorkspacePage />} path="/app" />
      <Route element={<WorkspacePage />} path="/workspace" />
      <Route element={<WorkspacePage />} path="/chat" />
      <Route element={<SettingsPage />} path="/settings" />
      <Route element={<SettingsPage />} path="/profile" />
      <Route element={<LibraryPage />} path="/library" />
      <Route element={<DocumentDetailPage />} path="/library/documents/:id" />
      <Route element={<AdminDashboardPage />} path="/admin" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}

export default App
