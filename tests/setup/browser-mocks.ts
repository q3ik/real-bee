/**
 * Comprehensive Browser API Mocks for Unit Tests
 * 
 * This file provides mock implementations of browser APIs that are not
 * available in the jsdom test environment. These mocks enable testing
 * of audio recording, playback, and processing features.
 * 
 * Addresses issue #626 - Phase 1: Critical Infrastructure
 */

import { vi } from 'vitest';

// ============================================================================
// MediaRecorder API Mock
// ============================================================================

class MockMediaRecorder {
  stream: unknown;
  mimeType: string;
  state: 'inactive' | 'recording' | 'paused';
  ondataavailable: ((event: { data: Blob; timecode: number }) => void) | null;
  onstop: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onpause: ((event: Event) => void) | null;
  onresume: ((event: Event) => void) | null;
  _options: Record<string, unknown>;
  _chunks: unknown[];
  _timesliceInterval: ReturnType<typeof setInterval> | null = null;

  constructor(stream: unknown, options: { mimeType?: string } = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
    this.onstart = null;
    this.onpause = null;
    this.onresume = null;
    this._options = options;
    this._chunks = [];
  }

  start(timeslice?: number) {
    if (this.state !== 'inactive') {
      throw new Error('MediaRecorder is not inactive');
    }
    
    this.state = 'recording';
    
    if (this.onstart) {
      this.onstart(new Event('start'));
    }
    
    // Simulate data being available after start
    if (timeslice) {
      this._timesliceInterval = setInterval(() => {
        this._emitData();
      }, timeslice);
    }
  }

  stop() {
    if (this.state === 'inactive') {
      throw new Error('MediaRecorder is already inactive');
    }
    
    if (this._timesliceInterval) {
      clearInterval(this._timesliceInterval);
    }
    
    this.state = 'inactive';
    
    // Emit final data
    this._emitData();
    
    if (this.onstop) {
      this.onstop(new Event('stop'));
    }
  }

  pause() {
    if (this.state !== 'recording') {
      throw new Error('MediaRecorder is not recording');
    }
    
    this.state = 'paused';
    
    if (this.onpause) {
      this.onpause(new Event('pause'));
    }
  }

  resume() {
    if (this.state !== 'paused') {
      throw new Error('MediaRecorder is not paused');
    }
    
    this.state = 'recording';
    
    if (this.onresume) {
      this.onresume(new Event('resume'));
    }
  }

  requestData() {
    if (this.state === 'inactive') {
      throw new Error('MediaRecorder is inactive');
    }
    
    this._emitData();
  }

  addEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self, eventName)) {
      self[eventName] = handler;
    }
  }

  removeEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self2 = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self2, eventName) && self2[eventName] === handler) {
      self2[eventName] = null;
    }
  }

  _emitData() {
    if (this.ondataavailable) {
      // Create a mock Blob with audio data
      const mockBlob = new Blob(
        [new Uint8Array([1, 2, 3, 4, 5])],
        { type: this.mimeType }
      );
      
      this.ondataavailable({
        data: mockBlob,
        timecode: Date.now(),
      });
    }
  }

  static isTypeSupported(mimeType: string): boolean {
    // Mock support for common audio types
    const supportedTypes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg',
    ];
    return supportedTypes.includes(mimeType);
  }
}

// ============================================================================
// AudioContext API Mock
// ============================================================================

class MockAudioContext {
  state: string;
  sampleRate: number;
  baseLatency: number;
  outputLatency: number;
  destination: Record<string, unknown>;
  listener: Record<string, unknown>;
  _startTime: number;
  _nodes: unknown[];

  constructor() {
    this.state = 'running';
    // REMOVED: this.currentTime = 0;
    // This was shadowing the getter below and causing TypeError
    // The getter now properly simulates time progression
    this.sampleRate = 44100;
    this.baseLatency = 0.01;
    this.outputLatency = 0.02;
    
    this.destination = {
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      maxChannelCount: 2,
      numberOfInputs: 1,
      numberOfOutputs: 0,
    };
    
    this.listener = {
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      forwardX: { value: 0 },
      forwardY: { value: 0 },
      forwardZ: { value: -1 },
      upX: { value: 0 },
      upY: { value: 1 },
      upZ: { value: 0 },
    };
    
    // Mock time progression
    this._startTime = Date.now();
    
    // Keep track of created nodes for cleanup
    this._nodes = [];
  }

  createMediaStreamSource(stream: unknown) {
    const node = {
      mediaStream: stream,
      connect: vi.fn((destination) => destination),
      disconnect: vi.fn(),
      channelCount: 2,
      channelCountMode: 'max',
      channelInterpretation: 'speakers',
      numberOfInputs: 0,
      numberOfOutputs: 1,
      context: this,
    };
    
    this._nodes.push(node);
    return node;
  }

  createAnalyser() {
    const analyser = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      minDecibels: -100,
      maxDecibels: -30,
      smoothingTimeConstant: 0.8,
      connect: vi.fn((destination) => destination),
      disconnect: vi.fn(),
      getByteFrequencyData: vi.fn((array) => {
        // Fill with mock frequency data
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 128);
        }
      }),
      getByteTimeDomainData: vi.fn((array) => {
        // Fill with mock waveform data
        for (let i = 0; i < array.length; i++) {
          array[i] = 128 + Math.floor(Math.random() * 64 - 32);
        }
      }),
      getFloatFrequencyData: vi.fn((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = -50 + Math.random() * 20;
        }
      }),
      getFloatTimeDomainData: vi.fn((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.random() * 2 - 1;
        }
      }),
      channelCount: 2,
      channelCountMode: 'max',
      channelInterpretation: 'speakers',
      numberOfInputs: 1,
      numberOfOutputs: 1,
      context: this,
    };
    
    this._nodes.push(analyser);
    return analyser;
  }

  createGain() {
    const gain = {
      gain: {
        value: 1,
        defaultValue: 1,
        minValue: 0,
        maxValue: 3.4028234663852886e38,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn((destination) => destination),
      disconnect: vi.fn(),
      channelCount: 2,
      channelCountMode: 'max',
      channelInterpretation: 'speakers',
      numberOfInputs: 1,
      numberOfOutputs: 1,
      context: this,
    };
    
    this._nodes.push(gain);
    return gain;
  }

  createOscillator() {
    const oscillator = {
      type: 'sine',
      frequency: {
        value: 440,
        defaultValue: 440,
        minValue: -22050,
        maxValue: 22050,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      detune: {
        value: 0,
        defaultValue: 0,
        minValue: -153600,
        maxValue: 153600,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn((destination) => destination),
      disconnect: vi.fn(),
      start: vi.fn((when = 0) => {}),
      stop: vi.fn((when = 0) => {}),
      channelCount: 2,
      channelCountMode: 'max',
      channelInterpretation: 'speakers',
      numberOfInputs: 0,
      numberOfOutputs: 1,
      context: this,
      onended: null,
    };
    
    this._nodes.push(oscillator);
    return oscillator;
  }

  createBufferSource() {
    const source = {
      buffer: null,
      playbackRate: {
        value: 1,
        defaultValue: 1,
        minValue: 0,
        maxValue: 3.4028234663852886e38,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      detune: {
        value: 0,
        defaultValue: 0,
        minValue: -153600,
        maxValue: 153600,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      connect: vi.fn((destination) => destination),
      disconnect: vi.fn(),
      start: vi.fn((when = 0, offset = 0, duration) => {}),
      stop: vi.fn((when = 0) => {}),
      channelCount: 2,
      channelCountMode: 'max',
      channelInterpretation: 'speakers',
      numberOfInputs: 0,
      numberOfOutputs: 1,
      context: this,
      onended: null,
    };
    
    this._nodes.push(source);
    return source;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn((channel) => new Float32Array(length)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    };
  }

  decodeAudioData(audioData: ArrayBuffer, successCallback?: (buffer: unknown) => void, errorCallback?: (error: Error) => void) {
    return new Promise((resolve, reject) => {
      // Mock successful decode
      const mockBuffer = this.createBuffer(2, 44100, 44100);
      
      if (successCallback) {
        successCallback(mockBuffer);
      }
      resolve(mockBuffer);
    });
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    // Clean up nodes
    this._nodes.forEach((node: unknown) => {
      if (node && typeof (node as Record<string, unknown>).disconnect === 'function') {
        (node as Record<string, () => void>).disconnect();
      }
    });
    this._nodes = [];
    return Promise.resolve();
  }

  get currentTime() {
    // Simulate time progression
    return (Date.now() - this._startTime) / 1000;
  }
}

// ============================================================================
// MediaStream and MediaDevices Mocks
// ============================================================================

class MockMediaStreamTrack {
  kind: string;
  id: string;
  label: string;
  enabled: boolean;
  muted: boolean;
  readyState: string;
  onended: ((event: Event) => void) | null;
  onmute: ((event: Event) => void) | null;
  onunmute: ((event: Event) => void) | null;

  constructor(kind = 'audio', label = 'Mock Audio Track') {
    this.kind = kind;
    this.id = `mock-track-${Math.random().toString(36).substr(2, 9)}`;
    this.label = label;
    this.enabled = true;
    this.muted = false;
    this.readyState = 'live';
    this.onended = null;
    this.onmute = null;
    this.onunmute = null;
  }

  stop() {
    this.readyState = 'ended';
    if (this.onended) {
      this.onended(new Event('ended'));
    }
  }

  clone() {
    return new MockMediaStreamTrack(this.kind, this.label);
  }

  getCapabilities() {
    return {
      echoCancellation: [true, false],
      autoGainControl: [true, false],
      noiseSuppression: [true, false],
      sampleRate: { min: 8000, max: 96000 },
      sampleSize: { min: 8, max: 32 },
      channelCount: { min: 1, max: 2 },
    };
  }

  getConstraints() {
    return {};
  }

  getSettings() {
    return {
      deviceId: this.id,
      groupId: 'mock-group',
      echoCancellation: true,
      autoGainControl: true,
      noiseSuppression: true,
      sampleRate: 44100,
      sampleSize: 16,
      channelCount: 1,
    };
  }

  applyConstraints(constraints: MediaTrackConstraints) {
    return Promise.resolve();
  }

  addEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self, eventName)) {
      self[eventName] = handler;
    }
  }

  removeEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self2 = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self2, eventName) && self2[eventName] === handler) {
      self2[eventName] = null;
    }
  }
}

class MockMediaStream {
  id: string;
  active: boolean;
  _tracks: MockMediaStreamTrack[];
  onaddtrack: ((event: { track: MockMediaStreamTrack }) => void) | null;
  onremovetrack: ((event: { track: MockMediaStreamTrack }) => void) | null;

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.id = `mock-stream-${Math.random().toString(36).substr(2, 9)}`;
    this.active = true;
    this._tracks = tracks.length > 0 ? tracks : [new MockMediaStreamTrack()];
    this.onaddtrack = null;
    this.onremovetrack = null;
  }

  getTracks() {
    return [...this._tracks];
  }

  getAudioTracks() {
    return this._tracks.filter(track => track.kind === 'audio');
  }

  getVideoTracks() {
    return this._tracks.filter(track => track.kind === 'video');
  }

  getTrackById(trackId: string) {
    return this._tracks.find(track => track.id === trackId) || null;
  }

  addTrack(track: MockMediaStreamTrack) {
    if (!this._tracks.includes(track)) {
      this._tracks.push(track);
      if (this.onaddtrack) {
        this.onaddtrack({ track });
      }
    }
  }

  removeTrack(track: MockMediaStreamTrack) {
    const index = this._tracks.indexOf(track);
    if (index !== -1) {
      this._tracks.splice(index, 1);
      if (this.onremovetrack) {
        this.onremovetrack({ track });
      }
    }
    
    if (this._tracks.length === 0) {
      this.active = false;
    }
  }

  clone() {
    const clonedTracks = this._tracks.map(track => track.clone());
    return new MockMediaStream(clonedTracks);
  }

  addEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self, eventName)) {
      self[eventName] = handler;
    }
  }

  removeEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self2 = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self2, eventName) && self2[eventName] === handler) {
      self2[eventName] = null;
    }
  }
}

// ============================================================================
// SpeechRecognition API Mock
// ============================================================================

class MockSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudiostart: ((event: Event) => void) | null;
  onsoundstart: ((event: Event) => void) | null;
  onspeechstart: ((event: Event) => void) | null;
  onspeechend: ((event: Event) => void) | null;
  onsoundend: ((event: Event) => void) | null;
  onaudioend: ((event: Event) => void) | null;
  onresult: ((event: unknown) => void) | null;
  onnomatch: ((event: Event) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  _isRunning: boolean;

  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'en-US';
    this.maxAlternatives = 1;
    
    // Event handlers
    this.onaudiostart = null;
    this.onsoundstart = null;
    this.onspeechstart = null;
    this.onspeechend = null;
    this.onsoundend = null;
    this.onaudioend = null;
    this.onresult = null;
    this.onnomatch = null;
    this.onerror = null;
    this.onstart = null;
    this.onend = null;
    
    this._isRunning = false;
  }

  start() {
    if (this._isRunning) {
      const error = new Error('recognition has already started');
      error.name = 'InvalidStateError';
      throw error;
    }
    
    this._isRunning = true;
    
    // Simulate async start
    setTimeout(() => {
      if (this.onstart) {
        this.onstart(new Event('start'));
      }
      if (this.onaudiostart) {
        this.onaudiostart(new Event('audiostart'));
      }
    }, 10);
  }

  stop() {
    if (!this._isRunning) {
      return;
    }
    
    this._isRunning = false;
    
    // Simulate async stop
    setTimeout(() => {
      if (this.onaudioend) {
        this.onaudioend(new Event('audioend'));
      }
      if (this.onend) {
        this.onend(new Event('end'));
      }
    }, 10);
  }

  abort() {
    if (!this._isRunning) {
      return;
    }
    
    this._isRunning = false;
    
    // Simulate immediate abort
    setTimeout(() => {
      if (this.onend) {
        this.onend(new Event('end'));
      }
    }, 5);
  }

  addEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self, eventName)) {
      self[eventName] = handler;
    }
  }

  removeEventListener(event: string, handler: EventListener) {
    const eventName = `on${event}`;
    const self2 = this as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(self2, eventName) && self2[eventName] === handler) {
      self2[eventName] = null;
    }
  }
}

// Mock getUserMedia
const mockGetUserMedia = vi.fn((constraints) => {
  return Promise.resolve(new MockMediaStream());
});

// Mock enumerateDevices
const mockEnumerateDevices = vi.fn(() => {
  return Promise.resolve([
    {
      deviceId: 'default',
      kind: 'audioinput',
      label: 'Default Microphone',
      groupId: 'default-group',
    },
    {
      deviceId: 'mock-mic-1',
      kind: 'audioinput',
      label: 'Mock Microphone 1',
      groupId: 'mock-group-1',
    },
  ]);
});

// ============================================================================
// Install Mocks into Global Scope
// ============================================================================

export function setupBrowserMocks() {
  // MediaRecorder
  (global as any).MediaRecorder = MockMediaRecorder;
  
  // AudioContext
  (global as any).AudioContext = MockAudioContext;
  (global as any).webkitAudioContext = MockAudioContext;
  
  // MediaStream and Tracks
  (global as any).MediaStream = MockMediaStream;
  (global as any).MediaStreamTrack = MockMediaStreamTrack;
  
  // SpeechRecognition
  (global as any).SpeechRecognition = MockSpeechRecognition;
  (global as any).webkitSpeechRecognition = MockSpeechRecognition;
  
  // Navigator media devices
  if (!global.navigator) {
    (global as any).navigator = {};
  }
  
  (global as any).navigator.mediaDevices = {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
    getSupportedConstraints: () => ({
      echoCancellation: true,
      autoGainControl: true,
      noiseSuppression: true,
      sampleRate: true,
      sampleSize: true,
      channelCount: true,
    }),
  };
  
  // Additional navigator properties
  (global as any).navigator.mediaCapabilities = {
    decodingInfo: vi.fn(() => Promise.resolve({
      supported: true,
      smooth: true,
      powerEfficient: true,
    })),
    encodingInfo: vi.fn(() => Promise.resolve({
      supported: true,
      smooth: true,
      powerEfficient: true,
    })),
  };
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

export function cleanupBrowserMocks() {
  // Reset all mocked functions using mockReset() instead of mockClear()
  // mockReset() removes mockResolvedValue/mockRejectedValue, preventing pollution
  const mediaDevices = (global as any).navigator?.mediaDevices;
  if (mediaDevices?.getUserMedia) {
    mediaDevices.getUserMedia.mockReset();
    // Restore default behavior after reset
    mediaDevices.getUserMedia.mockResolvedValue(
      new MockMediaStream()
    );
  }
  if (mediaDevices?.enumerateDevices) {
    mediaDevices.enumerateDevices.mockReset();
    // Restore default behavior after reset
    mediaDevices.enumerateDevices.mockResolvedValue([
      {
        deviceId: 'default',
        kind: 'audioinput',
        label: 'Default Microphone',
        groupId: 'default-group',
      },
      {
        deviceId: 'mock-mic-1',
        kind: 'audioinput',
        label: 'Mock Microphone 1',
        groupId: 'mock-group-1',
      },
    ]);
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to simulate successful microphone access
 */
export function mockSuccessfulMicrophoneAccess() {
  const mediaDevices = (global as any).navigator?.mediaDevices;
  if (mediaDevices?.getUserMedia) {
    mediaDevices.getUserMedia.mockResolvedValue(
      new MockMediaStream([new MockMediaStreamTrack('audio', 'Mock Microphone')])
    );
  }
}

/**
 * Helper to simulate denied microphone access
 */
export function mockDeniedMicrophoneAccess() {
  const mediaDevices = (global as any).navigator?.mediaDevices;
  if (mediaDevices?.getUserMedia) {
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    mediaDevices.getUserMedia.mockRejectedValue(error);
  }
}

/**
 * Helper to simulate microphone not found
 */
export function mockMicrophoneNotFound() {
  const mediaDevices = (global as any).navigator?.mediaDevices;
  if (mediaDevices?.getUserMedia) {
    const error = new Error('Requested device not found');
    error.name = 'NotFoundError';
    mediaDevices.getUserMedia.mockRejectedValue(error);
  }
}

/**
 * Helper to simulate successful speech recognition
 */
export function mockSuccessfulSpeechRecognition(transcript = 'test') {
  const recognition = new MockSpeechRecognition();
  const originalStart = recognition.start.bind(recognition);
  
  recognition.start = function() {
    originalStart();
    
    // Simulate recognition result after a delay
    setTimeout(() => {
      if (this.onresult) {
        const mockEvent = {
          results: [[
            {
              transcript,
              confidence: 0.95,
            },
          ]],
          resultIndex: 0,
        };
        this.onresult(mockEvent);
      }
    }, 100);
  };
  
  return recognition;
}

/**
 * Helper to simulate speech recognition error
 */
export function mockSpeechRecognitionError(errorType = 'not-allowed') {
  const recognition = new MockSpeechRecognition();
  const originalStart = recognition.start.bind(recognition);
  
  recognition.start = function() {
    originalStart();
    
    // Simulate error after a delay
    setTimeout(() => {
      if (this.onerror) {
        const mockError = {
          error: errorType,
          message: `Mock error: ${errorType}`,
        };
        this.onerror(mockError);
      }
    }, 50);
  };
  
  return recognition;
}

/**
 * Helper to get mock recorder instance for testing
 */
export function getMockRecorderInstance() {
  return new MockMediaRecorder(new MockMediaStream());
}

/**
 * Helper to simulate recording with data
 */
export function simulateRecordingWithData(recorder: InstanceType<typeof MockMediaRecorder>, duration = 1000) {
  return new Promise((resolve) => {
    const chunks: unknown[] = [];
    
    recorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };
    
    recorder.onstop = () => {
      resolve(chunks);
    };
    
    recorder.start();
    
    setTimeout(() => {
      recorder.stop();
    }, duration);
  });
}

// ============================================================================
// SessionStorage Mock
// ============================================================================

/** Shape returned by {@link createMockSessionStorage}. */
export interface MockStorage {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  length: number;
  key: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock sessionStorage object for unit tests.
 * Use with vi.stubGlobal('sessionStorage', createMockSessionStorage()) so the
 * module under test sees the mock instead of the real jsdom Storage.
 *
 * @param initialGetReturn - Initial return value for getItem (default: null)
 */
export function createMockSessionStorage(initialGetReturn: string | null = null): MockStorage {
  return {
    getItem: vi.fn(() => initialGetReturn),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(() => null),
  };
}
