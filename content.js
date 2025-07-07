const getTimeInSeconds = () => Math.floor(Date.now() / 1000);

let LAST_TIME_SUBTITLES_WAS_SEEN = getTimeInSeconds();

function log(...args) {
  console.log('[YouTube Captions Extension]', ...args);
}

function startObserver() {
  const samplingIntervalMs = 25; // How often to sample audio
  const historyDurationSeconds = 10; // Total history to retain
  const shortTermWindowMs = 300; // Shorter window for responsiveness
  const intensityLookbackMs = 200; // Look back to sync with caption timing
  const THRESHOLD = 0.02; // Noise suppression threshold
  const EMA_ALPHA = 0.2; // EMA smoothing factor

  let audioContext, source, analyser, dataArray;
  const audioSamples = []; // Each: { time, intensity, ema }

  let ema = 0;

  function setupAudioAnalyser() {
    const video = document.querySelector('video');
    if (!video) {
      console.error('No video element found!');
      return;
    }

    audioContext = new AudioContext();
    source = audioContext.createMediaElementSource(video);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    setInterval(sampleAudio, samplingIntervalMs);
  }

  function sampleAudio() {
    if (!analyser) return;

    analyser.getByteFrequencyData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255; // Scale to [0, 1]
      sumSquares += normalized ** 2;
    }

    let rms = Math.sqrt(sumSquares / dataArray.length);
    if (rms < THRESHOLD) rms = 0;

    // Update EMA
    ema = EMA_ALPHA * rms + (1 - EMA_ALPHA) * ema;

    const video = document.querySelector('video');
    const currentTime = video ? video.currentTime : 0;

    audioSamples.push({ time: currentTime, intensity: rms, ema });

    // Trim old samples
    const minTime = currentTime - historyDurationSeconds;
    while (audioSamples.length > 0 && audioSamples[0].time < minTime) {
      audioSamples.shift();
    }
  }

  function getMovingAverage() {
    if (audioSamples.length === 0) return 0;
    const sum = audioSamples.reduce((acc, sample) => acc + sample.intensity, 0);
    return sum / audioSamples.length;
  }

  function getShortTermEMA(targetTime) {
    const minTime = targetTime - shortTermWindowMs / 1000;
    const relevant = audioSamples.filter(
      (sample) => sample.time >= minTime && sample.time <= targetTime
    );
    if (relevant.length === 0) return 0;
    return relevant[relevant.length - 1].ema; // Take most recent EMA in window
  }

  const observer = new MutationObserver(() => {
    const captionsEl = document.querySelector('.captions-text');
    const video = document.querySelector('video');
    if (!video || !captionsEl) {
      if (LAST_TIME_SUBTITLES_WAS_SEEN + 5 < getTimeInSeconds()) {
        chrome.runtime.sendMessage({
          type: 'maybeSubtitlesAreOff',
        });
      }
      return;
    }
    LAST_TIME_SUBTITLES_WAS_SEEN = getTimeInSeconds();
    const text = captionsEl.innerText.trim();
    const currentTime = video.currentTime;
    // Look back slightly to align better with pause moments
    const targetTime = currentTime - intensityLookbackMs / 1000;
    const currentShortTermEMA = getShortTermEMA(targetTime);
    const averageIntensity = getMovingAverage();
    chrome.runtime.sendMessage({
      type: 'captionUpdate',
      text,
      currentTime,
      intensity: currentShortTermEMA,
      averageIntensity: averageIntensity,
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  setupAudioAnalyser();
}

function init() {
  const checkInterval = setInterval(() => {
    const captionsEl = document.querySelector('.captions-text');
    if (!captionsEl) {
      return;
    }

    clearInterval(checkInterval);
    startObserver();
  }, 25);
}

function pauseVideo() {
  const video = document.querySelector('video');
  if (video && !video.paused) {
    video.pause();
  }
}

function playVideo() {
  const video = document.querySelector('video');
  if (video && video.paused) {
    video.play();
  }
}

function setVideoCurrentTime(currentTime) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = currentTime;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'pauseVideo') {
    pauseVideo();
  } else if (message.type === 'playVideo') {
    playVideo();
  } else if (message.type === 'setVideoCurrentTime') {
    setVideoCurrentTime(message.currentTime);
    playVideo();
  }
});

console.log('hello everyone');
init();
