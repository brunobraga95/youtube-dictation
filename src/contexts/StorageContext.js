import React, { createContext, useContext, useEffect, useState } from 'react';

const StorageContext = createContext();

export const StorageProvider = ({ children }) => {
  const [userPreferences, setUserPreferences] = useState(null);

  useEffect(() => {
    const initializePreferences = async () => {
      const result = await chrome.storage.local.get('userPreferences');
      const currentPrefs = result.userPreferences || {};

      const hasMin = typeof currentPrefs.minWordsInSentence === 'number';
      const hasMax = typeof currentPrefs.maxWordsInSentence === 'number';
      const hasTimeBetweenSentences = typeof currentPrefs.timeBetweenSentences === 'number';

      const updatedPrefs = {
        ...currentPrefs,
        minWordsInSentence: hasMin ? currentPrefs.minWordsInSentence : 3,
        maxWordsInSentence: hasMax ? currentPrefs.maxWordsInSentence : 8,
        timeBetweenSentences: hasTimeBetweenSentences ? currentPrefs.timeBetweenSentences : 10,
      };

      await chrome.storage.local.set({ userPreferences: updatedPrefs });
      setUserPreferences(updatedPrefs);
    };

    initializePreferences();
  }, []);

  const writeUserPreferences = async (prefs) => {
    await chrome.storage.local.set({ userPreferences: prefs });
    setUserPreferences(prefs);
  };

  const getCurrentVideoStats = async () => {
    const result = await chrome.storage.local.get('currentVideoStats');
    return result.currentVideoStats || null;
  };

  const setCurrentVideoStats = async (stats) => {
    await chrome.storage.local.set({ currentVideoStats: stats });
  };

  const getOverallStats = async () => {
    const result = await chrome.storage.local.get('overallStats');
    return result.overallStats || null;
  };

  const setOverallStats = async (stats) => {
    await chrome.storage.local.set({ overallStats: stats });
  };

  return (
    <StorageContext.Provider
      value={{
        userPreferences,
        writeUserPreferences,
        getCurrentVideoStats,
        setCurrentVideoStats,
        getOverallStats,
        setOverallStats,
      }}
    >
      {userPreferences ? children : null}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
};
