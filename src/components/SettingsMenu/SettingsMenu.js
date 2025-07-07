import React, { useState, useEffect } from 'react';
import { FaCog } from 'react-icons/fa';
import { useStorage } from '../../contexts/StorageContext';
import './SettingsMenu.css';

const SettingsMenu = () => {
  const { userPreferences, writeUserPreferences } = useStorage();

  const [open, setOpen] = useState(false);
  const [minWords, setMinWords] = useState('');
  const [maxWords, setMaxWords] = useState('');
  const [timeBetweenSentences, setTimeBetweenSentences] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPrefs = async () => {
      const prefs = await userPreferences;
      if (prefs) {
        setMinWords(prefs.minWordsInSentence ?? '');
        setMaxWords(prefs.maxWordsInSentence ?? '');
        setTimeBetweenSentences(prefs.timeBetweenSentences ?? '');
      }
    };
    loadPrefs();
  }, [userPreferences]);

  const toggleMenu = () => {
    setOpen((prev) => !prev);
    setError('');
  };

  const handleSave = async () => {
    const min = Number(minWords);
    const max = Number(maxWords);
    const time = Number(timeBetweenSentences);

    if (isNaN(min) || isNaN(max) || isNaN(time)) {
      setError('Please enter valid numbers.');
      return;
    }

    if (min > max) {
      setError('Minimum words cannot be greater than maximum.');
      return;
    }

    if (min < 3) {
      setError('You need at least 3 minimum words');
      return;
    }

    if (max > 20) {
      setError('You can have at most 20 words');
      return;
    }

    if (time < 5) {
      setError('Please set at least 5 seconds until receiving new senteces');
      return;
    }

    if (time > 60) {
      setError('Please set at most 60 seconds until receiving new senteces');
      return;
    }

    await writeUserPreferences({
      minWordsInSentence: min,
      maxWordsInSentence: max,
      timeBetweenSentences: time,
    });

    setError('');
    setOpen(false);
  };

  return (
    <div className="settings-container">
      <button className="settings-icon" onClick={toggleMenu}>
        <FaCog />
      </button>
      {open && (
        <div className="settings-menu">
          <div className="form-group">
            <label htmlFor="minWords">Min words per sentence:</label>
            <input
              type="number"
              id="minWords"
              value={minWords}
              onChange={(e) => setMinWords(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="maxWords">Max words per sentence:</label>
            <input
              type="number"
              id="maxWords"
              value={maxWords}
              onChange={(e) => setMaxWords(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="timeBetweenSentences">Time between sentences (seconds):</label>
            <input
              type="number"
              id="timeBetweenSentences"
              value={timeBetweenSentences}
              onChange={(e) => setTimeBetweenSentences(e.target.value)}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
