import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // next dev auto-generates AGENTS.md/CLAUDE.md when it detects an AI coding
  // agent in the terminal. This project's own CLAUDE.md (repo root) already
  // covers that role, versioned and reviewed on purpose - disabled here so
  // next dev stops writing untracked files on top of it.
  agentRules: false,
};

export default withNextIntl(nextConfig);
