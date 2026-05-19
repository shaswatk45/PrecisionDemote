import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'

const HomePage = lazy(() => import('./pages/HomePage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'))

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-10 text-gray-400">Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
