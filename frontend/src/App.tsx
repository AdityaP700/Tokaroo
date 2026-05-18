import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { SimulateView } from './components/SimulateView';
import { CompareView } from './components/CompareView';
import { RagView } from './components/RagView';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('simulate');

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="main-content">
        {currentView === 'simulate' && <SimulateView />}
        {currentView === 'compare' && <CompareView />}
        {currentView === 'rag' && <RagView />}
      </main>
    </div>
  );
}

export default App;
