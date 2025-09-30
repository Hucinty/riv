import React from 'react';
import { Message as MessageType, Sender } from '../types';
import { AiAvatar } from './Avatar';
import { CodePlayground } from './CodePlayground';

interface MessageProps {
  message: MessageType;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const isAI = message.sender === Sender.AI;

  return (
    <div className={`flex items-start gap-3 ${isAI ? 'justify-start' : 'justify-end'} message-pop-in`}>
      {isAI && <AiAvatar />}
      <div className={`max-w-xs md:max-w-md lg:max-w-lg rounded-2xl shadow-sm transition-colors duration-500 ${isAI ? 'bg-ai-bubble text-strong rounded-tl-none' : 'bg-user-bubble text-white rounded-br-none'}`}>
         <div className="px-4 py-3">
            {message.imageUrl && (
              <img 
                src={message.imageUrl} 
                alt="User upload" 
                className="rounded-lg mb-2 max-w-full h-auto"
              />
            )}
            {message.text && <p className="text-sm break-words leading-relaxed">{message.text}</p>}
            {message.asciiArt && (
                <pre className="ascii-art text-strong">
                    {message.asciiArt}
                </pre>
            )}
        </div>
        {message.codeBlockContent && message.codeBlockLanguage && (
            <CodePlayground code={message.codeBlockContent} language={message.codeBlockLanguage} />
        )}
      </div>
    </div>
  );
};
