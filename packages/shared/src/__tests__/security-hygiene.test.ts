import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd(), "../..");

describe("Repository Security, Accessibility & Production Hygiene Gates", () => {
  it("configures strict CSP, HSTS, X-Frame-Options, and Permissions-Policy for SPA static assets", () => {
    const headers = readFileSync(resolve(ROOT, "apps/web/public/_headers"), "utf8");
    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).toContain("script-src 'self'");
    expect(headers).not.toContain("unsafe-eval");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("Strict-Transport-Security: max-age=31536000");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("Permissions-Policy:");
  });

  it("enforces WCAG 2.2 AA zoom, focus-visible, and reduced-motion baselines in web shell", () => {
    const html = readFileSync(resolve(ROOT, "apps/web/index.html"), "utf8");
    expect(html).not.toMatch(/maximum-scale\s*=\s*1/i);
    expect(html).not.toMatch(/user-scalable\s*=\s*no/i);

    const css = readFileSync(resolve(ROOT, "apps/web/src/index.css"), "utf8");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("disables production source maps, hardens relay Dockerfile, and removes hardcoded demo password", () => {
    const viteCfg = readFileSync(resolve(ROOT, "apps/web/vite.config.ts"), "utf8");
    expect(viteCfg).toContain("sourcemap: false");

    const dockerfile = readFileSync(resolve(ROOT, "services/applink-relay/Dockerfile"), "utf8");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("HEALTHCHECK");

    const seedScript = readFileSync(resolve(ROOT, "scripts/seed-demo.mjs"), "utf8");
    expect(seedScript).not.toContain("RentReady@2026");
    expect(seedScript).toContain("SEED_DEMO_PASSWORD");
    expect(seedScript).toContain("ALLOW_DEMO_SEED");
  });
});
