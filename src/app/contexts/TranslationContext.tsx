import React, { createContext, useContext, useState, useEffect } from 'react';

interface Translation {
  originalText: string;
  translatedText: string;
  progress: number;
}

interface TranslationContextType {
  currentTranslation: Translation | null;
  isPlaying: boolean;
  togglePlayback: () => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [currentTranslation, setCurrentTranslation] = useState<Translation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  // In a real implementation, you would fetch translations from your backend
  // and update the currentTranslation state accordingly

  return (
    <TranslationContext.Provider value={{ currentTranslation, isPlaying, togglePlayback }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
} 