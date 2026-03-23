# Test Infrastructure Documentation

This document describes the test infrastructure setup for the Buzzy Game project, including browser API mocks and network request interception.

## Overview

Our test infrastructure consists of three main components:

1. **Browser API Mocks** - Mock implementations of Web APIs (MediaRecorder, AudioContext, etc.)
2. **MSW (Mock Service Worker)** - Network request interception and mocking
3. **Test Setup** - Global test configuration and lifecycle management

## Table of Contents

- [Browser API Mocks](#browser-api-mocks)
- [Network Mocking with MSW](#network-mocking-with-msw)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Browser API Mocks

### Location
`tests/setup/browser-mocks.js`

### What's Mocked

The following browser APIs are automatically mocked for all tests:

#### MediaRecorder API
- `MediaRecorder` class with full recording lifecycle
- `start()`, `stop()`, `pause()`, `resume()` methods
- Event handlers (`ondataavailable`, `onstop`, `onerror`)
- Mock blob generation for audio data

#### AudioContext API
- `AudioContext` and `webkitAudioContext` classes
- Audio nodes: `createAnalyser()`, `createGain()`, `createOscillator()`
- `createMediaStreamSource()`, `createBufferSource()`
- Audio buffer creation and decoding
- Context state management (`running`, `suspended`, `closed`)

#### MediaStream and MediaDevices
- `MediaStream` and `MediaStreamTrack` classes
- `navigator.mediaDevices.getUserMedia()` mock
- `enumerateDevices()` with mock microphone devices
- Track management (add, remove, stop)

### Usage

These mocks are automatically initialized in `src/test/setup.js` and available in all tests:

```javascript
import { describe, test, expect } from 'vitest';

describe('Voice Recording', () => {
  test('can create MediaRecorder', () => {
    const stream = new MediaStream();
    const recorder = new MediaRecorder(stream);
    
    expect(recorder.state).toBe('inactive');
  });
  
  test('can start recording', () => {
    const stream = new MediaStream();
    const recorder = new MediaRecorder(stream);
    
    recorder.start();
    expect(recorder.state).toBe('recording');
  });
});
```

### Test Helpers

The browser-mocks module exports several helpers for common testing scenarios:

```javascript
import {
  mockSuccessfulMicrophoneAccess,
  mockDeniedMicrophoneAccess,
  mockMicrophoneNotFound,
  simulateRecordingWithData,
} from '../../tests/setup/browser-mocks.js';

describe('Microphone Access', () => {
  test('handles successful access', async () => {
    mockSuccessfulMicrophoneAccess();
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    expect(stream).toBeDefined();
    expect(stream.getAudioTracks()).toHaveLength(1);
  });
  
  test('handles denied access', async () => {
    mockDeniedMicrophoneAccess();
    
    await expect(
      navigator.mediaDevices.getUserMedia({ audio: true })
    ).rejects.toThrow('Permission denied');
  });
});
```

---

## Network Mocking with MSW

### Location
- `tests/mocks/server.js` - MSW server setup
- `tests/mocks/handlers.js` - Request handlers

### What's Mocked

All HTTP requests to `http://localhost:8788` are intercepted and mocked:

- `/api/user` - User CRUD operations
- `/api/progress` - Progress tracking
- `/api/stats` - User statistics
- `/api/feedback` - Feedback submission
- `/api/admin/*` - Admin endpoints
- `/api/test/*` - Error testing endpoints

### Usage

MSW is automatically configured in `src/test/setup.js`. Tests can make fetch calls normally:

```javascript
import { describe, test, expect } from 'vitest';

describe('User API', () => {
  test('can fetch user data', async () => {
    const response = await fetch('http://localhost:8788/api/user');
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe('test-user-123');
  });
});
```

### Custom Handlers for Specific Tests

You can override or add handlers for specific tests:

```javascript
import { describe, test, expect, afterEach } from 'vitest';
import { server } from '../../tests/mocks/server.js';
import { http, HttpResponse } from 'msw';

describe('Error Handling', () => {
  afterEach(() => {
    // Reset to default handlers after each test
    server.resetHandlers();
  });
  
  test('handles 500 server error', async () => {
    // Override handler for this test
    server.use(
      http.get('http://localhost:8788/api/user', () => {
        return HttpResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      })
    );
    
    const response = await fetch('http://localhost:8788/api/user');
    expect(response.status).toBe(500);
  });
});
```

### Helper Functions

The handlers module exports helpers for creating custom mocks:

```javascript
import {
  createMockHandler,
  createDelayedHandler,
  createErrorHandler,
} from '../../tests/mocks/handlers.js';

// Create a custom successful response
const customHandler = createMockHandler(
  'GET',
  '/api/custom',
  { data: 'custom response' },
  200
);

// Simulate slow network
const slowHandler = createDelayedHandler(
  'GET',
  '/api/slow',
  { data: 'slow response' },
  2000, // 2 second delay
  200
);

// Simulate network error
const errorHandler = createErrorHandler(
  'GET',
  '/api/error',
  'Connection failed'
);

server.use(customHandler, slowHandler, errorHandler);
```

---

## Writing Tests

### File Organization

```
src/
├── components/
│   └── MyComponent/
│       ├── MyComponent.jsx
│       └── MyComponent.test.jsx
├── hooks/
│   └── useMyHook/
│       ├── useMyHook.js
│       └── useMyHook.test.jsx
└── test/
    └── setup.js (global setup)

tests/
├── setup/
│   └── browser-mocks.js (browser API mocks)
├── mocks/
│   ├── server.js (MSW server)
│   └── handlers.js (API handlers)
└── qa/
    └── *.test.jsx (QA test suites)
```

### Component Tests

```javascript
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Hook Tests with Audio APIs

```javascript
import { describe, test, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { mockSuccessfulMicrophoneAccess } from '../../tests/setup/browser-mocks.js';
import { useVoiceInput } from './useVoiceInput';

describe('useVoiceInput', () => {
  test('requests microphone access', async () => {
    mockSuccessfulMicrophoneAccess();
    
    const { result } = renderHook(() => useVoiceInput());
    
    act(() => {
      result.current.startRecording();
    });
    
    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });
  });
});
```

### API Integration Tests

```javascript
import { describe, test, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '../../tests/mocks/server.js';
import { http, HttpResponse } from 'msw';
import { useUser } from './useUser';

describe('useUser', () => {
  test('fetches user data', async () => {
    const { result } = renderHook(() => useUser());
    
    await waitFor(() => {
      expect(result.current.user).toBeDefined();
      expect(result.current.user.id).toBe('test-user-123');
    });
  });
  
  test('handles fetch error', async () => {
    server.use(
      http.get('http://localhost:8788/api/user', () => {
        return HttpResponse.error();
      })
    );
    
    const { result } = renderHook(() => useUser());
    
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

---

## Troubleshooting

### Common Issues

#### "ReferenceError: MediaRecorder is not defined"

**Cause:** Browser mocks not initialized before test runs.

**Solution:** Ensure `setupBrowserMocks()` is called in `src/test/setup.js` before any tests run. This should be automatic.

#### "ECONNREFUSED" errors

**Cause:** MSW server not running or handler not defined for the endpoint.

**Solution:**
1. Check that MSW server is started in `src/test/setup.js` (`beforeAll(() => server.listen())`)
2. Add a handler for the endpoint in `tests/mocks/handlers.js`
3. Check console warnings for "Unhandled request" messages

#### Tests hang/timeout

**Cause:** Usually waiting for an event or promise that never resolves.

**Solution:**
1. Check that all async operations have proper mocks
2. Ensure MediaRecorder events are properly fired (our mock does this automatically)
3. Use `waitFor()` with a reasonable timeout
4. Add explicit timeouts to tests: `test('my test', async () => { ... }, 10000)`

#### "Cannot read properties of undefined"

**Cause:** Mock not properly initialized or missing mock property.

**Solution:**
1. Check that you're accessing properties that exist in the mock
2. For AudioContext nodes, ensure you're using the mocked methods
3. Check spelling of property names (e.g., `getUserMedia` not `getusermedia`)

### Debugging Tips

1. **Enable MSW request logging:**
   ```javascript
   // In tests/mocks/server.js, uncomment:
   server.events.on('request:start', ({ request }) => {
     console.log('MSW intercepted:', request.method, request.url);
   });
   ```

2. **Check mock state:**
   ```javascript
   test('debug test', () => {
     const recorder = new MediaRecorder(new MediaStream());
     console.log('Recorder state:', recorder.state);
     console.log('Available methods:', Object.keys(recorder));
   });
   ```

3. **Run single test file:**
   ```bash
   npm test -- src/hooks/useVoiceInput.test.jsx
   ```

4. **Run with verbose output:**
   ```bash
   npm test -- --reporter=verbose
   ```

---

## Best Practices

### 1. Keep Tests Isolated

```javascript
import { afterEach } from 'vitest';

afterEach(() => {
  // Clean up after each test
  vi.clearAllMocks();
  server.resetHandlers();
});
```

### 2. Use Descriptive Test Names

```javascript
// Good
test('starts recording when user grants microphone permission', async () => {
  // ...
});

// Bad
test('recording works', async () => {
  // ...
});
```

### 3. Test Error Cases

```javascript
test('handles denied microphone permission gracefully', async () => {
  mockDeniedMicrophoneAccess();
  // ... test error handling
});

test('recovers from network errors', async () => {
  server.use(createErrorHandler('GET', '/api/user'));
  // ... test error recovery
});
```

### 4. Use Test Helpers

Prefer using provided helpers over creating your own:

```javascript
// Good
import { mockSuccessfulMicrophoneAccess } from '../../tests/setup/browser-mocks.js';
mockSuccessfulMicrophoneAccess();

// Bad - reimplementing the helper
navigator.mediaDevices.getUserMedia = vi.fn(() => Promise.resolve(new MediaStream()));
```

### 5. Don't Test Implementation Details

```javascript
// Good - test behavior
test('displays user name after loading', async () => {
  render(<UserProfile />);
  await waitFor(() => {
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});

// Bad - test implementation
test('calls fetch with correct URL', async () => {
  render(<UserProfile />);
  expect(fetch).toHaveBeenCalledWith('http://localhost:8788/api/user');
});
```

### 6. Clean Up Resources

```javascript
test('cleans up AudioContext', async () => {
  const ctx = new AudioContext();
  
  // ... use context
  
  // Clean up
  await ctx.close();
  expect(ctx.state).toBe('closed');
});
```

---

## Running Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- src/hooks/useVoiceInput.test.jsx

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

---

## Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [MSW Documentation](https://mswjs.io/)
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

---

## Contributing

When adding new features that use browser APIs:

1. Check if the API is already mocked in `tests/setup/browser-mocks.js`
2. If not, add the mock to that file
3. Add test helpers for common use cases
4. Update this documentation

When adding new API endpoints:

1. Add handlers to `tests/mocks/handlers.js`
2. Follow the existing pattern for success/error responses
3. Add test endpoints (e.g., `/api/test/error`) if needed
4. Document the new endpoints in this file
