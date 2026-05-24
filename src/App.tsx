import { useState } from 'react';
import { AppProvider, useAppContext } from './lib/AppContext';
import { CustomerView } from './components/CustomerView';
import { AdminView } from './components/AdminView';
import { ToastContainer } from './components/Toast';

function TopNav({ page, setPage }: { page: string, setPage: (p: string) => void }) {
  const { status, statusCode } = useAppContext();
  
  return (
    <nav className="flex justify-between items-center gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-white/60 backdrop-blur-md sticky top-0 z-50 w-full border-b border-white/40">
        <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🌸</span>
            <div className="flex flex-col">
                <span className="font-bold tracking-wider hidden md:block leading-tight text-[var(--color-dark-brown)]">BLOOM LUXE</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-green-500 live-dot' : 'bg-red-500'}`}></div>
                    <span className={`text-[10px] font-medium uppercase tracking-widest ${status === 'live' ? 'text-green-600' : 'text-red-500'}`}>{status === 'live' ? 'Live System' : `Offline (${statusCode})`}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
            <button onClick={() => setPage('customer')} className={`touch-target px-3 py-2 md:px-4 md:py-2 rounded-lg text-xs md:text-sm ${page === 'customer' ? 'font-bold bg-[var(--color-primary-brown)] text-white shadow-md' : 'font-medium text-[#847568] hover:text-[var(--color-dark-brown)]'} whitespace-nowrap`}>Customer</button>
            <button onClick={() => setPage('admin')} className={`touch-target px-3 py-2 md:px-4 md:py-2 rounded-lg text-xs md:text-sm ${page === 'admin' ? 'font-bold bg-[var(--color-primary-brown)] text-white shadow-md' : 'font-medium text-[#847568] hover:text-[var(--color-dark-brown)]'} whitespace-nowrap`}>Staff</button>
        </div>
    </nav>
  );
}

function MainApp() {
  const [page, setPage] = useState('customer');
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');

  const navigateTo = (dest: string) => {
    if (dest === 'admin') {
      setShowLogin(true);
    } else {
      setPage('customer');
      setShowLogin(false);
    }
  };

  const handleLogin = () => {
    if (password === '1234') {
      setShowLogin(false);
      setPage('admin');
      setPassword('');
    } else {
      alert("Incorrect Password");
    }
  };

  return (
    <>
      <TopNav page={page} setPage={navigateTo} />
      {page === 'customer' && <CustomerView />}
      {page === 'admin' && <AdminView />}
      
      {showLogin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="glass-panel p-5 sm:p-8 rounded-2xl w-full max-w-sm text-center bg-[var(--color-bg-cream)]">
                <h3 className="text-xl font-bold text-[var(--color-dark-brown)] mb-4">🔐 Staff Login</h3>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="glass-input text-center mb-4 bg-white" placeholder="Password" />
                <button onClick={handleLogin} className="w-full py-3 bg-[var(--color-primary-brown)] text-white rounded-xl font-bold shadow-md">Login</button>
                <button onClick={() => setShowLogin(false)} className="mt-4 text-sm text-[#847568] hover:text-[var(--color-dark-brown)] underline font-medium">Back to Customer</button>
            </div>
        </div>
      )}
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
