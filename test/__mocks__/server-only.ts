// Mock for server-only package in unit test (jsdom) environment.
// The real package throws in non-Next.js runtimes; this no-op replacement
// lets server-side modules be imported and unit-tested without a Next.js server.
export {};
