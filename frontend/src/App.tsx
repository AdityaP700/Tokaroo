import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import {SplineTest} from './components/SplineTest';
import { MainWorkspace } from './components/Layout/MainWorkspace';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<Navigate to="/app/context" replace />} />
        <Route path="/app/:view" element={<MainWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
