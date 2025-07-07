import React from 'react';
import jumpingFox from './jumping-fox.gif';
import waitingFox from './waiting-fox.gif';
import './GifDisplayer.css';

const GifDisplayer = ({ src, alt = 'Animated GIF' }) => {
  const getGif = () => {
    if (src === 'jumping-fox') {
      return jumpingFox;
    } else if (src === 'waiting-fox') {
      return waitingFox;
    }
  };
  return (
    <div className="gif-container">
      <img src={getGif()} alt={alt} className="gif-image" />
    </div>
  );
};

export default GifDisplayer;
