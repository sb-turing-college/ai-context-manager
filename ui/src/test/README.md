# Frontend Test Suite

## Critical rules

1. **Never change production code to make a test pass** unless the product requirement changed. Prefer fixing the test only when the expectation is wrong — and document `TEST CHANGE:` when expectations must move.
2. **Never write to the production database `app.db`!** Always use a test database.
3. **Never make real API calls to AI providers (cost)!** Always use mocks.

## Setup

Tests use **Vitest + React Testing Library**.

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui

# Coverage report
npm run test:coverage
```

## Test layout

```
src/
├── services/
│   ├── __tests__/
│   │   └── chatService.test.ts    # Service tests
├── hooks/
│   ├── __tests__/                 # Hook tests (planned)
├── components/
│   ├── __tests__/                 # Component tests (planned)
└── test/
    ├── setup.ts                   # Test setup (mocks, etc.)
    ├── mocks/
    │   └── apiMocks.ts            # API mock helpers
    └── fixtures/
        └── chatFixtures.ts        # Test data
```

## Mocking strategy

### API calls (fetch)

All `fetch()` calls are mocked globally in `src/test/setup.ts`.

**CRITICAL:** AI API calls (Gemini, Claude) are **always** mocked:

```typescript
import { mockChatResponse, mockAuditResponse } from '../../test/mocks/apiMocks'

// Mock AI response (prevents real API calls!)
global.fetch = mockChatResponse({
  content: 'Test response',
  model: 'gemini-2.5-flash',
})
```

### Available mock helpers

- `mockChatResponse()` - Chat A responses
- `mockAuditResponse()` - Chat B audit responses
- `mockVerifyResponse()` - Chat B verify responses
- `mockSummaryResponse()` - Summary responses
- `mockApiSuccess()` - Generic successful API responses
- `mockApiError()` - Generic error responses

## Examples

### Service test

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { sendChatMessage } from '../chatService'
import { mockChatResponse } from '../../test/mocks/apiMocks'

describe('chatService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send chat message', async () => {
    global.fetch = mockChatResponse({
      content: 'Hello!',
    })

    const result = await sendChatMessage(mockRequest)
    
    expect(result.content).toBe('Hello!')
    // CRITICAL: Verify no real AI API call was made
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
```

## Coverage goals

- **Phase 1 (MVP):** Services 80%, overall ~50%
- **Phase 2 (Complete):** Services 90%, hooks 80%, components 70%, overall ~70%

## Best practices

1. **Isolation:** Each test is independent
2. **Mocking:** All external dependencies are mocked
3. **Assertions:** Clear, specific assertions
4. **Naming:** Descriptive names (`should do X when Y`)
5. **CRITICAL comments:** Mark places that prevent real API calls

## Troubleshooting

### Test fails because of fetch()

**Problem:** Test makes a real API call  
**Fix:** Ensure `global.fetch` is mocked before the test:

```typescript
beforeEach(() => {
  global.fetch = vi.fn() // Reset mock
})
```

### Test fails because of localStorage

**Problem:** localStorage is not mocked  
**Fix:** `src/test/setup.ts` mocks localStorage automatically.

### Test fails because of USE_API

**Problem:** `USE_API` is evaluated at import time  
**Fix:** Use `vi.stubEnv()` or skip the test (see `chatService.test.ts`).
