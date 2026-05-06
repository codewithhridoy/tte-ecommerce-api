// Provide minimum valid env vars so unit tests can import any module without
// crashing on ENV validation. Integration tests should override these via a
// real .env.test file loaded before this runs.
process.env["NODE_ENV"] ??= "test";
process.env["DATABASE_URL"] ??= "postgres://localhost:5432/tte_test";
process.env["REDIS_URL"] ??= "redis://localhost:6379";
process.env["JWT_ACCESS_SECRET"] ??= "test-access-secret-minimum-32-bytes!!!";
process.env["JWT_REFRESH_SECRET"] ??= "test-refresh-secret-minimum-32-bytes!!";
