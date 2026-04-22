#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step()   { echo -e "${CYAN}==> ${1}${NC}"; }
ok()     { echo -e "${GREEN}  ✓ ${1}${NC}"; }
warn()   { echo -e "${YELLOW}  ⚠ ${1}${NC}"; }
fail()   { echo -e "${RED}  ✗ ${1}${NC}"; exit 1; }

NODE_VERSION=$(node -v 2>/dev/null || true)
if [ -z "$NODE_VERSION" ]; then
  fail "Node.js is not installed. Install Node.js 20+ before running this script."
fi

MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$MAJOR" -lt 20 ]; then
  fail "Node.js ${NODE_VERSION} is too old. Requires 20+. Current: ${NODE_VERSION}"
fi
ok "Node.js ${NODE_VERSION}"

step "Installing dependencies..."
npm install --include=dev
ok "Dependencies installed"

step "Building all packages..."
node scripts/build.js
ok "All packages built"

step "Verifying CLI..."
VERSION=$(node packages/cli/dist/index.js --version 2>/dev/null || true)
if [ "$VERSION" = "0.1.0" ]; then
  ok "ws --version → ${VERSION}"
else
  fail "ws --version returned '${VERSION}', expected '0.1.0'"
fi

step "Running tests..."
npx vitest run --exclude="**/git/__tests__/**" --reporter=verbose 2>/dev/null | tail -5
ok "Tests complete (git network tests excluded)"

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "  Quick start:"
echo "    node packages/cli/dist/index.js --version"
echo "    node packages/cli/dist/index.js init"
echo "    node packages/cli/dist/index.js setup"
echo "    node packages/cli/dist/index.js start"
echo ""
echo "  Or link globally:"
echo "    cd packages/cli && npm link"
echo "    ws --version"
