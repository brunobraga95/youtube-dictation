import React, { useState } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa';
import './PauseDictation.css';

const PauseDictation = ({ initialPaused = false, onPauseChanged }) => {
  const [paused, setPaused] = useState(initialPaused);

  const handleClick = () => {
    onPauseChanged(!paused);
    setPaused(!paused);
  };

  return (
    <button className="dictation-button" onClick={handleClick}>
      {!paused ? 'Pause Dictation practice' : 'Restart dictation practice'}
      <span className="dictation-icon">{!paused ? <FaPause /> : <FaPlay />}</span>
    </button>
  );
};

export default PauseDictation;
