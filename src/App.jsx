import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import ErrorLogPanel from '@/components/ErrorLogPanel';

// Page imports
import Home from './pages/Home';
import ProjectDetail from './pages/ProjectDetail';
import Settings from './pages/Settings';
import ImportPrompts from './pages/ImportPrompts';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <div className="text-center space-y-4 p-8">
            <h2 className="text-xl font-semibold text-slate-800">
              {authError.type === 'auth_required' ? 'Session Expired' : 'Connection Error'}
            </h2>
            <p className="text-slate-500 text-sm">
              {authError.type === 'auth_required' 
                ? 'Please log in to continue.' 
                : authError.message || 'Something went wrong. Please try again.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigateToLogin()}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700"
              >
                Log In
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/ProjectDetail" element={<ProjectDetail />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/ImportPrompts" element={<ImportPrompts />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="bottom-right" richColors />
        <ErrorLogPanel />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App