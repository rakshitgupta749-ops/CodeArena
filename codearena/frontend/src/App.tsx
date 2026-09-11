import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoginPage } from "@/pages/LoginPage";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { ProblemsPage } from "@/pages/admin/ProblemsPage";
import { CreateProblemPage } from "@/pages/admin/CreateProblemPage";
import { SubmissionsPage } from "@/pages/admin/SubmissionsPage";
import { UserLayout } from "@/pages/user/UserLayout";
import { ProblemsListPage } from "@/pages/user/ProblemsListPage";
import { CodingTestPage } from "@/pages/user/CodingTestPage";
import { PreCodeAssessmentPage } from "@/pages/user/PreCodeAssessmentPage";
import { InterviewPage } from "@/pages/user/InterviewPage";
import { ReportPage } from "@/pages/user/ReportPage";
import { CandidatesPage } from "@/pages/admin/CandidatesPage";
import { CandidateProfilePage } from "@/pages/admin/CandidateProfilePage";
import { InterviewDetailPage } from "@/pages/admin/InterviewDetailPage";
import { ReportsPage } from "@/pages/admin/ReportsPage";
import { ReportDetailPage } from "@/pages/admin/ReportDetailPage";
import { AnalyticsPage } from "@/pages/admin/AnalyticsPage";
import { InterviewsPage } from "@/pages/admin/InterviewsPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { BatchesPage } from "@/pages/admin/BatchesPage";
import { AssignmentsPage } from "@/pages/admin/AssignmentsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRole={["admin", "faculty"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="candidates" element={<CandidatesPage />} />
              <Route path="candidates/:id" element={<CandidateProfilePage />} />
              <Route path="batches" element={<BatchesPage />} />
              <Route path="assignments" element={<AssignmentsPage />} />
              <Route path="interviews" element={<InterviewsPage />} />
              <Route path="interviews/:id" element={<InterviewDetailPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="problems" element={<ProblemsPage />} />
              <Route path="problems/create" element={<CreateProblemPage />} />
              <Route path="problems/edit/:id" element={<CreateProblemPage />} />
              <Route path="submissions" element={<SubmissionsPage />} />
            </Route>

            {/* User routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRole="user">
                  <UserLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/problems" replace />} />
              <Route path="problems" element={<ProblemsListPage />} />
              <Route path="problems/:id/precoding" element={<PreCodeAssessmentPage />} />
              <Route path="problems/:id" element={<CodingTestPage />} />
              <Route path="problems/:id/interview" element={<InterviewPage />} />
              <Route path="problems/:id/report" element={<ReportPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
