import { Routes, Route } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import CaretakerDashboard from './components/CaretakerDashboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/dashboard" element={<CaretakerDashboard />} />
    </Routes>
  );
}

export default App;