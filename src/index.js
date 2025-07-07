import React from 'react';
import { StorageProvider } from './contexts/StorageContext';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Import your global styles here

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <StorageProvider>
      <App />
    </StorageProvider>
  </React.StrictMode>
);
