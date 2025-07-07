import React, { useState, useEffect, useRef } from 'react';
import ReloadButton from '../ReloadButton/ReloadButton';
import RewardAnimation from '../RewardAnimation/RewardAnimation';
import GifDisplayer from '../GifDisplayer/GifDisplayer';
import { FaCopy } from 'react-icons/fa';
import './DictationPractice.css';

// Helper: clean word by removing punctuation and lowering case
// TODO: Bring back punctuation but just dont consider it when
const cleanWord = (word) => word.replace(/[.,!?;:"'()]/g, '').toLowerCase();

// Helper: compute Levenshtein distance
const editDistance = (a, b) => {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

const NextButton = ({ enabled, onClick }) => {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (enabled && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [enabled]);

  const handleClick = () => {
    if (enabled && typeof onClick === 'function') {
      onClick();
    }
  };

  return (
    <button
      ref={buttonRef}
      className={`next-button ${enabled ? '' : 'next-button-disabled'}`}
      onClick={handleClick}
      disabled={!enabled}
    >
      Next
    </button>
  );
};

function SkipButton({ enabled, onClick }) {
  return (
    <button className="skip-button" onClick={onClick}>
      Skip
    </button>
  );
}

function CopyToClipBoard({ onClick }) {
  return (
    <button className="copy-to-clipboard-button" onClick={onClick}>
      <FaCopy size={20} />
    </button>
  );
}

function DictationPractice({ sentence, onNextClicked, onReloadClicked }) {
  const cleanedSentence = sentence.split(' ').filter(word => cleanWord(word) !== "").join(' ');
  const words = cleanedSentence.split(' ');
  console.log(words);
  const [revealed, setRevealed] = useState([]);
  const [almostCorrect, setAlmostCorrect] = useState([]);
  const [userInputWords, setUserInputWords] = useState([]);
  const [input, setInput] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setRevealed(
      words.map((word, index) => {
        if (index < 2 || index >= words.length - 2) {
          return true;
        }
        return /^\d+$/.test(word);
      })
    );
    setAlmostCorrect(Array(words.length).fill(false));
    setUserInputWords(Array(words.length).fill(''));
    setInput('');
    inputRef.current?.focus();
  }, [sentence]);

  const handleChange = (e) => {
    const newInput = e.target.value;
    setInput(newInput);
    const inputWords = newInput.trim().split(' ');
    const newRevealed = [...revealed];
    const newAlmostCorrect = [...almostCorrect];
    const newUserInputWords = [...userInputWords];

    for (let i = 2; i < words.length - 2; i++) {
      const expectedWord = cleanWord(words[i]);
      const typedWordRaw = inputWords[i - 2] || '';
      const typedWord = cleanWord(typedWordRaw);

      newUserInputWords[i] = typedWordRaw;

      const isWordCommitted =
        i - 2 < inputWords.length - 1 ||
        (i - 2 === inputWords.length - 1 && newInput.endsWith(' '));

      if (typedWord === '') {
        newRevealed[i] = false;
        newAlmostCorrect[i] = false;
      } else if (isWordCommitted) {
        if (typedWord === expectedWord) {
          newRevealed[i] = true;
          newAlmostCorrect[i] = false;
        } else if (expectedWord.length >= 4 && editDistance(typedWord, expectedWord) <= 2) {
          newRevealed[i] = true;
          newAlmostCorrect[i] = true;
        } else {
          newRevealed[i] = false;
          newAlmostCorrect[i] = false;
        }
      } else {
        newRevealed[i] = false;
        newAlmostCorrect[i] = false;
      }
    }

    setRevealed(newRevealed);
    setAlmostCorrect(newAlmostCorrect);
    setUserInputWords(newUserInputWords);
  };

  const revealedCount = revealed.filter(Boolean).length;
  const progress = Math.round((revealedCount / words.length) * 100);
  const allRevealed = revealed.length > 0 && revealed.every((word) => word);
  return (
    <div className="dictation-container">
      <h2 className="dictation-title">Dictation Practice</h2>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="sentence-display-and-copy-wrapper">
        <div className="sentence-display">
          {words.map((word, index) => (
            <span
              onMouseEnter={() => (!revealed[index] ? setHoveredIndex(index) : null)}
              onMouseLeave={() => (!revealed[index] ? setHoveredIndex(null) : null)}
              key={index}
              className="word-wrapper"
            >
              {revealed[index] ? (
                almostCorrect[index] ? (
                  <span className="almost-correct-wrapper">
                    <span className="almost-correct-word">{word}</span>
                    {userInputWords[index]}
                  </span>
                ) : (
                  word
                )
              ) : hoveredIndex === index ? (
                <span className="hovered-word">{word}</span>
              ) : (
                '_'.repeat(word.length)
              )}
            </span>
          ))}
        </div>
        <CopyToClipBoard onClick={() => navigator.clipboard.writeText(sentence)} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={handleChange}
        placeholder="Type the missing words..."
        className="dictation-input"
      />
      <div className="bottom-buttons-wrapper">
        <ReloadButton onClick={onReloadClicked} />
        <div className="action-buttons-wrapper">
          <SkipButton onClick={onNextClicked} />
          <NextButton enabled={allRevealed} onClick={onNextClicked} />
        </div>
      </div>
      {allRevealed ? <GifDisplayer src="jumping-fox" /> : null}
      <RewardAnimation startAnimation={allRevealed} />
    </div>
  );
}

export default DictationPractice;
