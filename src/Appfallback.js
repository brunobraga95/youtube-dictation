import React, { useEffect, useState, useRef } from 'react';
import DictationPractice from './components/DictationPractice/DictationPractice';
import SettingsMenu from './components/SettingsMenu/SettingsMenu';
import { useStorage } from './contexts/StorageContext';
import './index.css';

// Create a an api that returns whether something is a word.
function removeFillerWords(sentence, language = 'en') {
  const fillerWords = {
    en: ['um', 'uh', 'er', 'ah', 'hmm'],
    es: ['eh', 'em', 'este'],
    fr: ['euh'],
    de: ['äh', 'ähm', 'mhm'],
    pt: ['ah', 'hã', 'hum'],
    it: ['eh'],
    // expand as needed
  };

  const fillers = fillerWords[language] || fillerWords['en'];

  const pattern = new RegExp(`\\b(${fillers.join('|')})\\b`, 'gi');

  let cleaned = sentence
    .replace(pattern, '') // remove fillers
    .replace(/\s{2,}/g, ' ') // collapse extra spaces
    .replace(/\s{2,}/g, '"') // collapse extra spaces
    .replace(/\s{2,}/g, ',') // collapse extra spaces
    .replace(/\s+([,.!?;:])/g, '$1') // remove space BEFORE punctuation
    .replace(/([,.!?;:])\1+/g, '$1') // collapse repeated punctuation (,, → ,)
    .replace(/([,.!?;:])([^\s])/g, '$1 $2') // ensure space AFTER punctuation
    .replace(/\s{2,}/g, ' ') // collapse again if needed
    .trim();

  return cleaned;
}

function extractLastSentenceFromWordArrayBasedOnTime(
  wordsArray,
  generateSubtitles,
  usersPreferences
) {
  if (generateSubtitles === false) {
    // Skip the words that are currently in display, meaning the last ones with the same current time.
    let index = wordsArray.length - 1;
    if (index === -1) {
      return '';
    }
    let timeToSkip = wordsArray[index].currentTime;
    while (index >= 0 && wordsArray[index].currentTime == timeToSkip) {
      index--;
    }
    if (index == -1) {
      return '';
    }
    wordsArray = wordsArray.slice(0, index + 1);
  }

  function getWordsBetween(wordsArray, startIndex, endIndex) {
    const slice = wordsArray.slice(startIndex, endIndex + 1); // inclusive
    const sentence = slice.map((obj) => obj.word).join(' ');
    let getStartTime = (index) => {
      const t = wordsArray[index].currentTime;
      while (index >= 0 && wordsArray[index].currentTime === t) {
        index--;
      }
      if (index === -1) {
        return t - 2 /** remove 2s to be sure */;
      }
      return wordsArray[index].currentTime - 2 /** remove 2s to be sure */;
    };
    return {
      sentence,
      startTime: getStartTime(startIndex),
      endTime: wordsArray[endIndex].currentTime,
    };
  }

  const MIN_WORDS = usersPreferences.minWordsInSentence;
  const MAX_WORDS = usersPreferences.maxWordsInSentence;
  if (!wordsArray || wordsArray.length < MAX_WORDS) {
    return '';
  }
  let lowIntensities = [];
  // Find all the pause points (indices where the next word is delayed)
  for (let i = 0; i < wordsArray.length - 1; i++) {
    const currentWord = wordsArray[i];
    const nextWordIntensity = wordsArray[i + 1].intensity;
    const intensityChange = nextWordIntensity / currentWord.intensity;
    if (intensityChange < 0.4) {
      lowIntensities.push(i);
    }
  }
  if (
    lowIntensities.length < 2 ||
    lowIntensities[lowIntensities.length - 1] - lowIntensities[0] < MIN_WORDS
  ) {
    return getWordsBetween(wordsArray, wordsArray.length - MAX_WORDS, wordsArray.length - 1);
  }
  if (lowIntensities[lowIntensities.length - 1] - lowIntensities[0] <= MAX_WORDS) {
    return getWordsBetween(
      wordsArray,
      lowIntensities[0],
      lowIntensities[lowIntensities.length - 1]
    );
  }
  let start = lowIntensities[0];
  let end = lowIntensities[lowIntensities.length - 1];
  while (start - end > MAX_WORDS && start >= MIN_WORDS) {
    start--;
  }
  if (start < MIN_WORDS) {
    return getWordsBetween(wordsArray, wordsArray.length - MAX_WORDS, wordsArray.length - 1);
  }
  return getWordsBetween(wordsArray, start - 1, end + 1);
}

function keepLastNWords(arr, maxWords = 70) {
  return arr.slice(-maxWords);
}

function mergeWordArrays(A, B, currentTime, intensity, averageIntensity, maxWords = 50) {
  if (!A || A.length === 0) {
    return keepLastNWords(
      B.trim()
        .split(/\s+/)
        .map((word) => ({
          word,
          currentTime,
          intensity,
          averageIntensity,
          percentIntensity: intensity / averageIntensity,
        })),
      maxWords
    );
  }

  const AString = A.map((obj) => obj.word).join(' ');
  const BWords = B.trim().split(/\s+/);

  let overlapIndex = 0;
  for (let i = BWords.length; i > 0; i--) {
    const overlapCandidate = BWords.slice(0, i).join(' ');
    if (AString.endsWith(overlapCandidate)) {
      overlapIndex = i;
      break;
    }
  }

  // Sequentially compare from the end, but only update the LAST matching word
  let aIndex = A.length - BWords.length;
  if (aIndex < 0) {
    aIndex = 0; // avoid negative indexes
  }

  let lastMatchingIndex = -1;

  for (let i = 0; i < BWords.length; i++) {
    const word = BWords[i];
    const currentAIndex = aIndex + i;
    if (currentAIndex >= 0 && currentAIndex < A.length) {
      const existing = A[currentAIndex];
      if (existing.word === word) {
        lastMatchingIndex = currentAIndex; // remember the last matching position
      }
    }
  }

  // Now, update only the last matching word (if any)
  if (lastMatchingIndex !== -1) {
    const existing = A[lastMatchingIndex];
    if (intensity < existing.intensity) {
      A[lastMatchingIndex] = {
        ...existing,
        intensity,
        averageIntensity,
        percentIntensity: intensity / averageIntensity,
      };
    }
  }

  // Add only the non-overlapping words
  const newWords = BWords.slice(overlapIndex).map((word) => ({
    word,
    currentTime,
    intensity,
    averageIntensity,
    percentIntensity: intensity / averageIntensity,
  }));
  return keepLastNWords(A.concat(newWords), maxWords);
}

const sendContentScriptMessage = (message) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length <= 0) {
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, message);
  });
};

const PlayOrPause = (pause) => {
  sendContentScriptMessage({ type: pause ? 'pauseVideo' : 'playVideo' });
};

const onReload = (time) => {
  // subtract 2 seconds to be sure.
  sendContentScriptMessage({
    type: 'setVideoCurrentTime',
    currentTime: time - 2,
  });
};

const checkIfSubtitlesAreLikelyGenerated = (lastSentences) => {
  if (lastSentences.length < 40) {
    return null;
  }
  let uniqueSentences = new Set();
  for (let sentence of lastSentences) {
    uniqueSentences.add(sentence);
  }
  return uniqueSentences.size / lastSentences.length > 0.45 ? true : false;
};

const App = () => {
  const [currentWords, setCurrentWords] = useState([]);
  const [lastSentences, setLastSentences] = useState([]);
  const [generateSubtitles, setGenerateSubtitles] = useState(null);
  const [extractedSentence, setExtractedSentence] = useState(null);
  const [reloadClickedDoNotCaputureAndPauseAtTime, setReloadClickedDoNotCaputureAndPauseAtTime] =
    useState(null);
  const [applyLoadingPeriod, setApplyLoadingPeriod] = useState(null);
  const [isCoolDown, setCoolDown] = useState(null);
  const [delayedFlag, setDelayedFlag] = useState(true);
  const [usersPreferences, setUsersPreferences] = useState();
  const currentWordsRef = useRef(currentWords);
  const lastSentencesRef = useRef(lastSentences);
  const isCoolDownRef = useRef(isCoolDown);
  const reloadClickedDoNotCaputureAndPauseAtTimeRef = useRef(
    reloadClickedDoNotCaputureAndPauseAtTime
  );
  const delayedFlagRef = useRef(delayedFlag);
  const generateSubtitlesRef = useRef(generateSubtitles);
  const usersPreferencesRef = useRef(usersPreferences);
  const applyLoadingPeriodRef = useRef(applyLoadingPeriod);
  const { getUserPreferences } = useStorage();

  useEffect(() => {
    const loadPrefs = async () => {
      const prefs = await getUserPreferences();
      setUsersPreferences(prefs);
    };
    loadPrefs();
  }, [getUserPreferences]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDelayedFlag(false);
    }, 4000); // 4 seconds

    // Cleanup on unmount
    return () => clearTimeout(timer);
  }, []);

  const triggerCoolDown = (time) => {
    setCoolDown(time);
  };
  useEffect(() => {
    currentWordsRef.current = currentWords;
  }, [currentWords]);
  useEffect(() => {
    applyLoadingPeriodRef.current = applyLoadingPeriod;
  }, [applyLoadingPeriod]);
  useEffect(() => {
    usersPreferencesRef.current = usersPreferences;
  }, [usersPreferences]);
  useEffect(() => {
    generateSubtitlesRef.current = generateSubtitles;
  }, [generateSubtitles]);
  useEffect(() => {
    lastSentencesRef.current = lastSentences;
    if (generateSubtitles !== null) {
      return;
    }
    setGenerateSubtitles(checkIfSubtitlesAreLikelyGenerated(lastSentences));
  }, [lastSentences]);
  useEffect(() => {
    isCoolDownRef.current = isCoolDown;
  }, [isCoolDown]);
  useEffect(() => {
    reloadClickedDoNotCaputureAndPauseAtTimeRef.current = reloadClickedDoNotCaputureAndPauseAtTime;
  }, [reloadClickedDoNotCaputureAndPauseAtTime]);
  useEffect(() => {
    delayedFlagRef.current = delayedFlag;
  }, [delayedFlag]);

  useEffect(() => {
    const listener = (message) => {
      if (message.type !== 'captionUpdate') {
        return;
      }
      setLastSentences([...lastSentencesRef.current, message.text]);
      if (delayedFlagRef.current) {
        return;
      }
      if (
        applyLoadingPeriodRef &&
        applyLoadingPeriodRef.current &&
        applyLoadingPeriodRef.current <= message.currentTime
      ) {
        return;
      }
      // figure out why i need this if statement
      if (reloadClickedDoNotCaputureAndPauseAtTimeRef.current > message.currentTime) {
        return;
      }
      if (
        reloadClickedDoNotCaputureAndPauseAtTimeRef &&
        reloadClickedDoNotCaputureAndPauseAtTimeRef.current &&
        reloadClickedDoNotCaputureAndPauseAtTimeRef.current <= message.currentTime
      ) {
        PlayOrPause(/*pause=*/ true);
        setReloadClickedDoNotCaputureAndPauseAtTime(null);
        return;
      }
      const currentCoolDown = isCoolDownRef.current;
      if (currentCoolDown && message.currentTime - currentCoolDown > 5) {
        setCoolDown(null);
      }
      if (currentCoolDown) {
        return;
      }
      let newSentence = removeFillerWords(message.text.replace(/[\r\n]+/g, ' ').trim());
      let newWords = mergeWordArrays(
        currentWordsRef.current,
        newSentence,
        message.currentTime,
        message.intensity,
        message.averageIntensity
      );
      // console.log(usersPreferencesRef.current)
      let sentenceExtracted = extractLastSentenceFromWordArrayBasedOnTime(
        newWords.filter((word) => word.currentTime < message.currentTime),
        generateSubtitlesRef.current,
        usersPreferencesRef.current
      );
      const sentence = sentenceExtracted?.sentence || '';
      if (sentence === '') {
        setCurrentWords(newWords);
        return;
      }
      // If a sentence was picked, reset to start again.
      console.log(sentenceExtracted, newWords);
      setCurrentWords([]);
      setExtractedSentence(sentenceExtracted);
      triggerCoolDown(message.currentTime);
      PlayOrPause(/*pause=*/ true);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);
  const sentence = extractedSentence?.sentence || '';
  const sentenceStartTime = extractedSentence?.startTime;
  const sentenceEndTime = extractedSentence?.endTime || 0;
  const loadingPeriod = sentenceEndTime + (usersPreferences?.timeBetweenSentences || 0);
  console.log(sentence, loadingPeriod);
  return (
    <div>
      <div className="settings-cog-wrapper">
        <SettingsMenu />
      </div>
      {sentence !== '' ? (
        <DictationPractice
          sentence={sentence}
          onReloadClicked={() => {
            setReloadClickedDoNotCaputureAndPauseAtTime(sentenceEndTime);
            onReload(sentenceStartTime);
          }}
          onNextClicked={() => {
            setExtractedSentence(null);
            setApplyLoadingPeriod(loadingPeriod);
            PlayOrPause(/*pause=*/ false);
          }}
        />
      ) : (
        <h2 className="title">Your next sentence is comming...</h2>
      )}
    </div>
  );
};

export default App;
