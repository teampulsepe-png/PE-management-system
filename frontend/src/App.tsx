import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Tickets from './pages/Tickets'
import Kpi from './pages/Kpi'
import Pipelines from './pages/Pipelines'
import AiSubs from './pages/Ai_subs'
import ProjectLifecycle from './pages/Project_Lifecycle'
import Tracker from './pages/Tracker'
import Workload from './pages/Workload'
import Settings from './pages/Settings'
import Agent from './pages/Agent'
import Cost from './pages/Cost'
import LiveOps from './pages/LiveOps'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/liveops" element={<LiveOps />} />
            <Route path="/kpi" element={<Kpi />} />
            <Route path="/pipelines" element={<Pipelines />} />
            <Route path="/ai-subs" element={<AiSubs />} />
            <Route path="/project-lifecycle" element={<ProjectLifecycle />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/workload" element={<Workload />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/agent" element={<Agent />} />
            <Route path="/cost" element={<Cost />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
