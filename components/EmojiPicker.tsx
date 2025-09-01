import React from 'react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

const emojis = [
  '😀', '😂', '😍', '🤔', '😢', '😡',
  '👍', '👎', '❤️', '🎉', '🔥', '⭐',
  '👋', '🙏', '💯', '😊', '😎', '🚀'
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
  return (
    <div className="absolute bottom-20 right-0 bg-main p-3 rounded-2xl shadow-lg border border-themed z-10 w-60">
       <div className="grid grid-cols-6 gap-2">
        {emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => onEmojiSelect(emoji)}
            className="text-2xl rounded-lg p-1 hover:bg-input transition-colors duration-200"
            aria-label={`Select emoji ${emoji}`}
          >
            {emoji}
          </button>
        ))}
       </div>
    </div>
  );
};
