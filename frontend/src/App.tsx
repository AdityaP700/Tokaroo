import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { MainWorkspace } from './components/Layout/MainWorkspace';
import './index.css';

function App() {
  const [page, setPage] = useState<'landing' | 'app'>('landing');

  return page === 'landing'
    ? <LandingPage onEnter={() => setPage('app')} />
    : <MainWorkspace />;
}

export default App;
