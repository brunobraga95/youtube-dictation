import React from 'react';
import './FeedbackButton.css';

function FeedbackButton({}) {
  return (
    <button
      className="feedback-button"
      onClick={() =>
        window.open(
          'https://docs.google.com/forms/d/e/1FAIpQLSdKDZ5waJC9ucwqRmpf1r8noxPf_-Ac59KTTfEPfYn_roDTkg/viewform?usp=header',
          '_blank'
        )
      }
    >
      Feedback :D
    </button>
  );
}

export default FeedbackButton;
