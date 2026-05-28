import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { DocumentsListPage } from '@/pages/documents/DocumentsListPage'
import { CreateDocumentPage } from '@/pages/documents/CreateDocumentPage'
import { DocumentDetailPage } from '@/pages/documents/DocumentDetailPage'
import { UsersPage } from '@/pages/admin/UsersPage'
import { ApprovalWorkflowsPage } from '@/pages/admin/ApprovalWorkflowsPage'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'documents', element: <DocumentsListPage /> },
          { path: 'documents/new', element: <CreateDocumentPage /> },
          { path: 'documents/:id', element: <DocumentDetailPage /> },
          { path: 'admin/users', element: <UsersPage /> },
          { path: 'admin/approval-workflows', element: <ApprovalWorkflowsPage /> },
          { path: 'admin/circuitos', element: <ApprovalWorkflowsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
