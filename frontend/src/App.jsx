import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { NotificationProvider } from './components/NotificationContext'
import NotificationContainer from './components/NotificationContainer'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherClasses from './pages/TeacherClasses'
import TeacherAttendance from './pages/TeacherAttendance'
import TeacherLessons from './pages/TeacherLessons'
import TeacherGrades from './pages/TeacherGrades'
import TeacherProfile from './pages/TeacherProfile'
import TeacherLayout from './components/TeacherLayout'
import StudentDashboard from './pages/StudentDashboard'
import FinanceDashboard from './pages/FinanceDashboard'
import AdminStudents from './pages/AdminStudents'
import AdminTeachers from './pages/AdminTeachers'
import AdminTeacherProfile from './pages/AdminTeacherProfile'
import AdminStudentDashboard from './pages/AdminStudentDashboard'
import AdminStudentInvoices from './pages/AdminStudentInvoices'
import AdminStudentPayments from './pages/AdminStudentPayments'
import AdminCurriculum from './pages/AdminCurriculum'
import AdminReports from './pages/AdminReports'
import AdminClasses from './pages/AdminClasses'
import AdminClassProfile from './pages/AdminClassProfile'
import AdminUsers from './pages/AdminUsers'
import AdminSchool from './pages/AdminSchool'
import AdminExams from './pages/AdminExams'
import AdminResults from './pages/AdminResults'
import AdminFees from './pages/AdminFees'
import AdminEvents from './pages/AdminEvents'
import AdminAcademicCalendar from './pages/AdminAcademicCalendar'
import AdminSubjects from './pages/AdminSubjects'
import AdminSubjectProfile from './pages/AdminSubjectProfile'
import Messages from './pages/Messages'
import AdminLayout from './components/AdminLayout'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (!roles) return children
  // Treat superuser/staff as admin
  const isAdminAccess = roles.includes('admin') && (user?.is_superuser || user?.is_staff || user?.role === 'admin')
  const hasRole = roles.includes(user?.role)
  if (isAdminAccess || hasRole) return children
  // If user has no explicit role but is superuser, allow admin
  if ((user?.is_superuser || user?.is_staff) && roles.includes('admin')) return children
  return <Navigate to={`/${user?.role || 'login'}`} />
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  return <Navigate to={`/${user.role}`} />
}

export default function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <Routes>
          {/* Default to Admin dashboard */}
          <Route path="/" element={<Navigate to="/admin" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard/></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute roles={["admin"]}><AdminStudents/></ProtectedRoute>} />
          <Route path="/admin/students/:id" element={<ProtectedRoute roles={["admin"]}><AdminStudentDashboard/></ProtectedRoute>} />
          <Route path="/admin/students/:id/invoices" element={<ProtectedRoute roles={["admin"]}><AdminStudentInvoices/></ProtectedRoute>} />
          <Route path="/admin/students/:id/payments" element={<ProtectedRoute roles={["admin"]}><AdminStudentPayments/></ProtectedRoute>} />
          <Route path="/admin/teachers" element={<ProtectedRoute roles={["admin"]}><AdminTeachers/></ProtectedRoute>} />
          <Route path="/admin/teachers/:id" element={<ProtectedRoute roles={["admin"]}><AdminTeacherProfile/></ProtectedRoute>} />
          <Route path="/admin/classes" element={<ProtectedRoute roles={["admin"]}><AdminClasses/></ProtectedRoute>} />
          <Route path="/admin/classes/:id" element={<ProtectedRoute roles={["admin"]}><AdminClassProfile/></ProtectedRoute>} />
          <Route path="/admin/fees" element={<ProtectedRoute roles={["admin"]}><AdminFees/></ProtectedRoute>} />
          <Route path="/admin/curriculum" element={<ProtectedRoute roles={["admin"]}><AdminCurriculum/></ProtectedRoute>} />
          <Route path="/admin/subjects" element={<ProtectedRoute roles={["admin"]}><AdminSubjects/></ProtectedRoute>} />
          <Route path="/admin/subjects/:id" element={<ProtectedRoute roles={["admin"]}><AdminSubjectProfile/></ProtectedRoute>} />
          <Route path="/admin/exams" element={<ProtectedRoute roles={["admin"]}><AdminExams/></ProtectedRoute>} />
          <Route path="/admin/results" element={<ProtectedRoute roles={["admin"]}><AdminResults/></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReports/></ProtectedRoute>} />
          <Route path="/admin/school" element={<ProtectedRoute roles={["admin"]}><AdminSchool/></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers/></ProtectedRoute>} />
          <Route path="/admin/events" element={<ProtectedRoute roles={["admin"]}><AdminEvents/></ProtectedRoute>} />
          <Route path="/admin/calendar" element={<ProtectedRoute roles={["admin"]}><AdminAcademicCalendar/></ProtectedRoute>} />
          <Route path="/admin/messages" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Messages/></AdminLayout></ProtectedRoute>} />
          <Route path="/teacher" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherDashboard/></TeacherLayout></ProtectedRoute>} />
          <Route path="/teacher/messages" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><Messages/></TeacherLayout></ProtectedRoute>} />
          <Route path="/teacher/classes" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherClasses/></TeacherLayout></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherAttendance/></TeacherLayout></ProtectedRoute>} />
          <Route path="/teacher/lessons" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherLessons/></TeacherLayout></ProtectedRoute>} />
          <Route path="/teacher/grades" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherGrades/></TeacherLayout></ProtectedRoute>} />
          <Route path="/teacher/profile" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherProfile/></TeacherLayout></ProtectedRoute>} />
          <Route path="/student" element={<ProtectedRoute roles={["student","admin"]}><StudentDashboard/></ProtectedRoute>} />
          <Route path="/student/messages" element={<ProtectedRoute roles={["student","admin"]}><Messages/></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute roles={["finance","admin"]}><FinanceDashboard/></ProtectedRoute>} />
          <Route path="/finance/messages" element={<ProtectedRoute roles={["finance","admin"]}><Messages/></ProtectedRoute>} />
        </Routes>
        <NotificationContainer />
      </AuthProvider>
    </NotificationProvider>
  )
}
