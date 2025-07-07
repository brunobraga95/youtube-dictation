import React, { useEffect, useState, useRef } from 'react';
import DictationPractice from './components/DictationPractice/DictationPractice';
import SettingsMenu from './components/SettingsMenu/SettingsMenu';
import FeedbackButton from './components/FeedbackButton/FeedbackButton';
import PauseDictation from './components/PauseDictation/PauseDictation';
import GifDisplayer from './components/GifDisplayer/GifDisplayer';
import { useStorage } from './contexts/StorageContext';
import './index.css';

// Create a an api that returns whether something is a word.
function removeFillerWords(sentence, language = 'en') {
  const alwaysPresent = '(auto-generated)';
  const fillerWords = {
    en: ['um', 'uh', 'er', 'ah', 'hmm'],
    es: ['eh', 'em', 'este'],
    fr: ['euh'],
    de: ['äh', 'ähm', 'mhm'],
    pt: ['ah', 'hã', 'hum'],
    it: ['eh'],
    // expand as needed
  };
  for (const lan in fillerWords) {
    fillerWords[lan].push(alwaysPresent);
  }
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
  userPreferences
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

  const MIN_WORDS = userPreferences.minWordsInSentence;
  const MAX_WORDS = userPreferences.maxWordsInSentence;
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
  const [waitingSentence, setWaitingSentence] = useState('Your next sentence is comming...');
  const [lastSentences, setLastSentences] = useState([]);
  const [generateSubtitles, setGenerateSubtitles] = useState(null);
  const [extractedSentence, setExtractedSentence] = useState(null);
  const [reloadClickedDoNotCaputureAndPauseAtTime, setReloadClickedDoNotCaputureAndPauseAtTime] =
    useState(null);
  const [applyLoadingPeriod, setApplyLoadingPeriod] = useState(null);
  const [isCoolDown, setCoolDown] = useState(null);
  const [userPausedDictation, setUserPausedDictation] = useState(false);
  const [delayedFlag, setDelayedFlag] = useState(true);
  const [areSubtitlesOn, setAreSubtitlesOn] = useState(false);

  const areSubtitlesOnRef = useRef(areSubtitlesOn);
  const currentWordsRef = useRef(currentWords);
  const lastSentencesRef = useRef(lastSentences);
  const isCoolDownRef = useRef(isCoolDown);
  const reloadClickedDoNotCaputureAndPauseAtTimeRef = useRef(
    reloadClickedDoNotCaputureAndPauseAtTime
  );
  const delayedFlagRef = useRef(delayedFlag);
  const generateSubtitlesRef = useRef(generateSubtitles);
  const { userPreferences } = useStorage();
  const userPreferencesRef = useRef(userPreferences);
  const applyLoadingPeriodRef = useRef(applyLoadingPeriod);
  const waitingSentenceRef = useRef(waitingSentence);
  const userPausedDictationRef = useRef(userPausedDictation);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDelayedFlag(false);
    }, userPreferences.timeBetweenSentences * 1000);

    // Cleanup on unmount
    return () => clearTimeout(timer);
  }, []);

  const triggerCoolDown = (time) => {
    setCoolDown(time);
  };
  useEffect(() => {
    areSubtitlesOnRef.current = areSubtitlesOn;
  }, [areSubtitlesOn]);
  useEffect(() => {
    currentWordsRef.current = currentWords;
  }, [currentWords]);
  useEffect(() => {
    userPausedDictationRef.current = userPausedDictation;
  }, [userPausedDictation]);
  useEffect(() => {
    waitingSentenceRef.current = waitingSentence;
  }, [waitingSentence]);
  useEffect(() => {
    applyLoadingPeriodRef.current = applyLoadingPeriod;
    // Reset if the user liked jumped around the video.
  }, [applyLoadingPeriod]);
  useEffect(() => {
    userPreferencesRef.current = userPreferences;
  }, [userPreferences]);
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
      if (message.type === 'maybeSubtitlesAreOff' && areSubtitlesOnRef.current) {
        console.log(message.type, areSubtitlesOnRef.current);
        setAreSubtitlesOn(false);
        return;
      }
      if (message.type !== 'captionUpdate') {
        return;
      }

      if (!areSubtitlesOnRef.current) {
        console.log('areSubtitlesOnRef.current: ', areSubtitlesOnRef.current);
        setAreSubtitlesOn(true);
      }
      if (userPausedDictationRef?.current) {
        return;
      }
      if (delayedFlagRef.current) {
        return;
      }
      setLastSentences([...lastSentencesRef.current, message.text]);
      if (applyLoadingPeriodRef?.current) {
        // Reset applyLoadingPeriod if the user likely skipped around the video.
        // this checks that the range is outside of the current time. The 3 seconds is just to be
        // extra sure, so I increase the range.
        if (
          message.currentTime < applyLoadingPeriodRef.current.sentenceStartTime - 3 ||
          message.currentTime > applyLoadingPeriodRef.current.loadingPeriod + 3
        ) {
          setApplyLoadingPeriod({
            sentenceStartTime: message.currentTime,
            loadingPeriod:
              message.currentTime + (userPreferencesRef?.current?.timeBetweenSentences || 0),
          });
          return;
        }
        if (applyLoadingPeriodRef.current.loadingPeriod >= message.currentTime) {
          const newWaitingSentence =
            'Your next sentence is coming in ' +
            parseInt(applyLoadingPeriodRef.current.loadingPeriod - message.currentTime) +
            ' seconds';
          if (waitingSentenceRef.current != newWaitingSentence) {
            setWaitingSentence(newWaitingSentence);
          }
          return;
        } else {
          // This allows new messages to be taken
          setApplyLoadingPeriod(null);
        }
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
      let sentenceExtracted = extractLastSentenceFromWordArrayBasedOnTime(
        newWords.filter((word) => word.currentTime < message.currentTime),
        generateSubtitlesRef.current,
        userPreferencesRef.current
      );
      const sentence = sentenceExtracted?.sentence || '';
      if (sentence === '') {
        setCurrentWords(newWords);
        return;
      }
      // If a sentence was picked, reset to start again.
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
  const sentenceStartTime = extractedSentence?.startTime - 2; /* remove 3 seconds to be sure.*/
  const sentenceEndTime = extractedSentence?.endTime || 0;
  const loadingPeriod = sentenceEndTime + (userPreferences.timeBetweenSentences || 0);
  const getDictationComponent = () => (
    <DictationPractice
      sentence={sentence}
      onReloadClicked={() => {
        setReloadClickedDoNotCaputureAndPauseAtTime(sentenceEndTime);
        onReload(sentenceStartTime);
      }}
      onNextClicked={() => {
        setExtractedSentence(null);
        setApplyLoadingPeriod({ sentenceStartTime, loadingPeriod });
        PlayOrPause(/*pause=*/ false);
      }}
      onSkipClicked={() => {
        setExtractedSentence(null);
        setApplyLoadingPeriod({ sentenceStartTime, loadingPeriod });
        PlayOrPause(/*pause=*/ false);
      }}
    />
  );
  const getWaitingForNewSentenceComponent = () => (
    <React.Fragment>
      <h2 className="title">{waitingSentence}</h2>
      <GifDisplayer src="waiting-fox" />
      <PauseDictation
        onPauseChanged={(paused) => {
          if (userPausedDictation === paused) {
            return;
          }
          if (paused) {
            setApplyLoadingPeriod(null);
            setWaitingSentence('Restart dictation practice to receive new sentences');
          } else {
            setWaitingSentence('Your next sentence is comming...');
          }
          setUserPausedDictation(paused);
        }}
        initialPaused={userPausedDictation}
      />
    </React.Fragment>
  );
  const getSubtitlesOffComponent = () => (
    <React.Fragment>
      <h2 className="title">
        Please make sure you have an youtube video playing and the subtitles are on
      </h2>
      <GifDisplayer src="waiting-fox" />
    </React.Fragment>
  );
  const getMainComponent = () => {
    if (!areSubtitlesOn) {
      return getSubtitlesOffComponent();
    }
    if (sentence !== '') {
      return getDictationComponent();
    }
    return (
      <div className="body-without-rendered-sentence">{getWaitingForNewSentenceComponent()}</div>
    );
  };
  return (
    <div>
      <div className="settings-and-feedback-wrapper">
        <FeedbackButton />
        <SettingsMenu />
      </div>
      {getMainComponent()}
    </div>
  );
};

export default App;
