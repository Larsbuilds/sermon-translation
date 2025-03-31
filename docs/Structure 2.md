sermon-translation/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── audio/
│   │   │   │   ├── AudioCapture.tsx      # Audio input and analysis
│   │   │   │   ├── AudioVisualizer.tsx   # Visualization from VJ Website
│   │   │   │   └── TranslationPlayer.tsx # Translation playback
│   │   │   ├── device/
│   │   │   │   ├── DeviceManager.tsx     # Device connection management
│   │   │   │   └── DeviceStatus.tsx      # Device status display
│   │   │   └── translation/
│   │   │       ├── LanguageSelector.tsx  # Language selection
│   │   │       └── TranslationControls.tsx # Translation controls
│   │   ├── lib/
│   │   │   ├── audio/
│   │   │   │   ├── analyzer.ts          # Audio analysis (from VJ Website)
│   │   │   │   ├── capture.ts           # Audio capture utilities
│   │   │   │   └── processing.ts        # Audio processing utilities
│   │   │   ├── orchestration/
│   │   │   │   ├── client.ts            # BBC Orchestration client wrapper
│   │   │   │   ├── device.ts            # Device management
│   │   │   │   └── sync.ts              # Synchronization utilities
│   │   │   └── translation/
│   │   │       ├── service.ts           # Translation service
│   │   │       └── types.ts             # Translation types
│   │   └── page.tsx                     # Main application page
│   └── types/
│       └── index.ts                     # Global 