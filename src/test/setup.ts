import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
    signUp: {
      email: vi.fn(),
    },
    signOut: vi.fn(),
  },
}));
