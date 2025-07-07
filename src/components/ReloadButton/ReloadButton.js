import React from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import './ReloadButton.css';

function ReloadButton({ onClick }) {
  return (
    <button className="reload-button" onClick={onClick}>
      <FiRefreshCw size={24} />
    </button>
  );
}

export default ReloadButton;
