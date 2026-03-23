/**
 * MSW Request Handlers
 * 
 * These handlers intercept network requests during tests and return
 * mock responses. This prevents ECONNREFUSED errors when tests attempt
 * to connect to localhost:8788 or other API endpoints.
 * 
 * Part of Phase 1 for issue #626
 */

import { http, HttpResponse, type HttpRequestHandler } from 'msw';

type HttpMethodKey = 'all' | 'head' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options';

function getHttpMethod(method: string): HttpRequestHandler {
  const key = method.toLowerCase() as HttpMethodKey;
  const handler = http[key];
  if (!handler) {
    throw new Error(`Invalid HTTP method: ${method}`);
  }
  return handler;
}

// ============================================================================
// CORS Helpers
// ============================================================================

const FEEDBACK_ALLOWED_ORIGINS = [
  'https://buzzy-game.pages.dev',
  'https://bee.q3ik.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function isFeedbackOriginAllowed(origin: string): boolean {
  return (
    FEEDBACK_ALLOWED_ORIGINS.some(allowed => allowed === origin) ||
    origin.match(/^https:\/\/.*\.buzzy-game\.pages\.dev$/) !== null
  );
}

// Mock user data
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock progress data
const mockProgress = {
  user_id: 'test-user-123',
  level: 5,
  points: 1250,
  streak: 7,
  total_words_found: 342,
  total_games_played: 45,
  last_played: '2024-01-15T10:30:00Z',
};

// Mock stats data
const mockStats = {
  accuracy: 0.85,
  average_score: 150,
  best_score: 320,
  total_hints_used: 23,
  perfect_games: 5,
};

export const handlers = [
  // ============================================================================
  // User API Endpoints - Wildcard patterns for both absolute and relative URLs
  // ============================================================================
  
  // GET /api/user - Get current user
  http.get('*/api/user', () => {
    return HttpResponse.json(
      { success: true, user: mockUser },
      { status: 200 }
    );
  }),

  // POST /api/user - Create user
  http.post('*/api/user', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    
    return HttpResponse.json(
      {
        success: true,
        user: {
          ...mockUser,
          ...body,
          id: 'new-user-' + Date.now(),
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }),

  // PATCH /api/user - Update user
  http.patch('*/api/user', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    
    return HttpResponse.json(
      {
        success: true,
        user: {
          ...mockUser,
          ...body,
          updated_at: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  }),

  // DELETE /api/user - Delete user
  http.delete('*/api/user', () => {
    return HttpResponse.json(
      { success: true, message: 'User deleted' },
      { status: 200 }
    );
  }),

  // ============================================================================
  // Progress API Endpoints
  // ============================================================================
  
  // GET /api/progress - Get user progress
  http.get('*/api/progress', () => {
    return HttpResponse.json(
      { success: true, progress: mockProgress },
      { status: 200 }
    );
  }),

  // POST /api/progress - Update progress
  http.post('*/api/progress', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    
    return HttpResponse.json(
      {
        success: true,
        progress: {
          ...mockProgress,
          ...body,
        },
      },
      { status: 200 }
    );
  }),

  // ============================================================================
  // Stats API Endpoints
  // ============================================================================
  
  // GET /api/stats - Get user statistics
  http.get('*/api/stats', () => {
    return HttpResponse.json(
      { success: true, stats: mockStats },
      { status: 200 }
    );
  }),

  // ============================================================================
  // Feedback API Endpoints
  // ============================================================================
  
  // POST /api/feedback - Submit feedback
  http.post('*/api/feedback', async ({ request }) => {
    const origin = request.headers.get('origin') || '';
    
    // CORS check - only allow known origins
    if (!origin || !isFeedbackOriginAllowed(origin)) {
      return HttpResponse.json(
        { error: 'Origin not allowed' },
        { status: 403 }
      );
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return HttpResponse.json(
        { error: 'Invalid request body', details: ['Expected valid JSON payload'] },
        { status: 400 }
      );
    }

    // Validate required fields and schema
    const errors: string[] = [];

    if (!body.text || typeof body.text !== 'string') {
      errors.push('text: text is required');
    } else if (body.text.length > 1000) {
      errors.push('text: text must be at most 1000 characters');
    }

    const allowedTypes = ['bug', 'suggestion', 'general'];
    if (!body.type || !allowedTypes.includes(body.type as string)) {
      errors.push('type: type must be one of: bug, suggestion, general');
    }

    // Strict schema: reject unknown fields
    const knownFields = new Set([
      'text', 'user', 'type', 'email', 'userId', 'url', 'route',
      'deviceType', 'screenSize', 'appVersion', 'sessionId',
      'userAgent', 'browserInfo', 'diagnostics',
    ]);
    const unknownFields = Object.keys(body).filter(k => !knownFields.has(k));
    if (unknownFields.length > 0) {
      errors.push(`Unexpected fields not allowed: ${unknownFields.join(', ')}`);
    }

    if (errors.length > 0) {
      return HttpResponse.json(
        { error: 'Invalid feedback data', details: errors },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        success: true,
        feedbackId: 'feedback-' + Date.now(),
        deliveredVia: { database: true },
      },
      { status: 200 }
    );
  }),

  // OPTIONS /api/feedback - CORS preflight
  http.options('*/api/feedback', ({ request }) => {
    const origin = request.headers.get('origin') || '';
    
    if (!origin || !isFeedbackOriginAllowed(origin)) {
      return new HttpResponse(null, { status: 403 });
    }

    return new HttpResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }),

  // ============================================================================
  // Voice/Speech API Endpoints
  // ============================================================================
  
  // POST /api/tts - Text-to-Speech
  http.post('*/api/tts', async ({ request }) => {
    try {
      const body = await request.json() as Record<string, unknown>;
      
      // Validate input
      if (!body.text || typeof body.text !== 'string') {
        return HttpResponse.json(
          { error: 'Missing or invalid text parameter' },
          { status: 400 }
        );
      }
      
      // Return mock audio data as ArrayBuffer (simulates real TTS API)
      // Create a small audio buffer to simulate real binary audio data
      const mockAudioBuffer = new ArrayBuffer(1024);
      const view = new Uint8Array(mockAudioBuffer);
      // Fill with some mock audio data pattern
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256;
      }
      
      return new HttpResponse(mockAudioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(mockAudioBuffer.byteLength),
        },
      });
    } catch (error) {
      return HttpResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
  }),

  // POST /api/stt - Speech-to-Text
  http.post('*/api/stt', async ({ request }) => {
    // Validate Content-Type
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.startsWith('audio/') && !contentType.startsWith('multipart/form-data')) {
      return HttpResponse.json(
        { error: 'Unsupported content type. Expected audio/* or multipart/form-data' },
        { status: 400 }
      );
    }
    
    // Validate audio data exists
    let audioData;
    try {
      if (contentType.startsWith('multipart/form-data')) {
        const formData = await request.formData();
        const audioFile = formData.get('audio');
        if (!audioFile) {
          return HttpResponse.json(
            { error: 'No audio file found in form data' },
            { status: 400 }
          );
        }
        audioData = await (audioFile as Blob).arrayBuffer();
      } else {
        audioData = await request.arrayBuffer();
      }
      
      if (!audioData || audioData.byteLength === 0) {
        return HttpResponse.json(
          { error: 'Audio data is empty' },
          { status: 400 }
        );
      }
    } catch (error) {
      return HttpResponse.json(
        { error: 'Failed to read audio data' },
        { status: 400 }
      );
    }
    
    // Mock Deepgram-style response format
    return HttpResponse.json(
      {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: 'mock transcription',
                  confidence: 0.95,
                },
              ],
            },
          ],
        },
      },
      { status: 200 }
    );
  }),

  // ============================================================================
  // Admin API Endpoints
  // ============================================================================
  
  // GET /api/admin/users - Get all users (admin)
  http.get('*/api/admin/users', () => {
    return HttpResponse.json(
      {
        success: true,
        users: [mockUser],
        total: 1,
      },
      { status: 200 }
    );
  }),

  // GET /api/admin/stats - Get system stats (admin)
  http.get('*/api/admin/stats', () => {
    return HttpResponse.json(
      {
        success: true,
        stats: {
          total_users: 1250,
          active_users: 342,
          total_games: 15670,
          average_session_duration: 420,
        },
      },
      { status: 200 }
    );
  }),

  // Wildcard for all other admin routes
  http.all('*/api/admin/*', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      {
        success: true,
        message: `Mock admin response for ${url.pathname}`,
        data: {},
      },
      { status: 200 }
    );
  }),

  // ============================================================================
  // Sync API Endpoints (wildcard for all sync routes)
  // ============================================================================
  
  http.all('*/api/sync/*', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      {
        success: true,
        synced: true,
        message: `Mock sync response for ${url.pathname}`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // ============================================================================
  // Error Handlers for Testing Error States
  // ============================================================================
  
  // GET /api/test/error - Simulate server error
  http.get('*/api/test/error', () => {
    return HttpResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }),

  // GET /api/test/unauthorized - Simulate unauthorized
  http.get('*/api/test/unauthorized', () => {
    return HttpResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }),

  // GET /api/test/notfound - Simulate not found
  http.get('*/api/test/notfound', () => {
    return HttpResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }),

  // GET /api/test/timeout - Simulate timeout (delayed response)
  http.get('*/api/test/timeout', async () => {
    // Delay response to simulate timeout
    await new Promise(resolve => setTimeout(resolve, 10000));
    return HttpResponse.json(
      { success: true, data: 'This should timeout' },
      { status: 200 }
    );
  }),

  // ============================================================================
  // Catch-all for unmocked /api/* routes
  // Returns 501 Not Implemented to make missing mocks obvious
  // ============================================================================
  
  http.all('*/api/*', ({ request }) => {
    const url = new URL(request.url);
    console.warn(`⚠️  Unmocked API request: ${request.method} ${url.pathname}`);
    
    return HttpResponse.json(
      {
        success: false,
        error: 'Not Implemented',
        message: `Mock handler not implemented for: ${request.method} ${url.pathname}`,
        hint: 'Add a handler in tests/mocks/handlers.js',
      },
      { status: 501 }
    );
  }),
];

// ============================================================================
// Helper Functions for Test Customization
// ============================================================================

/**
 * Create a handler for a custom endpoint
 * Useful for test-specific mocking
 */
export function createMockHandler(method: string, path: string, response: unknown, status = 200) {
  const url = path.startsWith('http') || path.startsWith('*') ? path : `*${path}`;
  const httpMethod = getHttpMethod(method);
  return httpMethod(url, () => {
    return HttpResponse.json(response as Parameters<typeof HttpResponse.json>[0], { status });
  });
}

/**
 * Create a handler that simulates network delay
 */
export function createDelayedHandler(method: string, path: string, response: unknown, delay = 1000, status = 200) {
  const url = path.startsWith('http') || path.startsWith('*') ? path : `*${path}`;
  const httpMethod = getHttpMethod(method);
  return httpMethod(url, async () => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return HttpResponse.json(response as Parameters<typeof HttpResponse.json>[0], { status });
  });
}

/**
 * Create a handler that simulates network error
 */
export function createErrorHandler(method: string, path: string, _errorMessage = 'Network error') {
  const url = path.startsWith('http') || path.startsWith('*') ? path : `*${path}`;
  const httpMethod = getHttpMethod(method);
  return httpMethod(url, () => {
    return HttpResponse.error();
  });
}
