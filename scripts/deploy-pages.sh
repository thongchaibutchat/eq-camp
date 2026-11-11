#!/usr/bin/env bash
# Deploy the built web tool to GitHub Pages (branch gh-pages) → https://thongchaibutchat.github.io/eq-camp/
# Usage: npm run build && bash scripts/deploy-pages.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); TMP=$(mktemp -d)
git -C "$ROOT" fetch -q origin gh-pages && git -C "$ROOT" worktree add -q "$TMP" origin/gh-pages
cp "$ROOT/EQ_Camp_Generator.html" "$TMP/index.html"; touch "$TMP/.nojekyll"
cd "$TMP" && git add -A && { git diff --cached --quiet && echo "no change"; } || git commit -qm "Deploy web $(date +%F)" && git push -q origin HEAD:gh-pages
cd "$ROOT" && git worktree remove --force "$TMP"; echo "deployed → https://thongchaibutchat.github.io/eq-camp/"
