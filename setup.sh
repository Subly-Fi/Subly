#!/bin/bash
# Run this after cloning: ./setup.sh
# Configures git hooks and verifies safety mechanisms.

set -euo pipefail

echo "Setting up Subly development environment..."
echo ""

# 1. Configure git hooks
git config core.hooksPath .githooks
echo "  [ok] Git hooks configured (.githooks/)"

# 2. Verify .gitignore has _internal/
if grep -q "^_internal/" .gitignore; then
  echo "  [ok] .gitignore excludes _internal/"
else
  echo "  [FAIL] .gitignore missing _internal/ — adding it now"
  echo "_internal/" >> .gitignore
fi

# 3. Verify hooks are executable
chmod +x .githooks/pre-commit .githooks/pre-push
echo "  [ok] Hooks are executable"

# 4. Verify _internal/ is not tracked
if git ls-files | grep -q "^_internal/"; then
  echo "  [FAIL] _internal/ files are tracked! Run: git rm -r --cached _internal/"
  exit 1
else
  echo "  [ok] _internal/ is not tracked"
fi

# 5. Install dependencies
if command -v pnpm &> /dev/null; then
  echo ""
  echo "Installing dependencies..."
  pnpm install
else
  echo ""
  echo "  [warn] pnpm not found. Install it: curl -fsSL https://get.pnpm.io/install.sh | sh"
fi

echo ""
echo "Setup complete."
