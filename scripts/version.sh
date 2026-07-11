#!/usr/bin/env bash
set -euo pipefail

# `version` is a pnpm lifecycle script: it runs after pnpm bumps package.json
# but before pnpm creates the version commit/tag. So here we only need to
# update README.md to point at the new tag and stage it for that commit.

version=$(node -p "require('./package.json').version")
tag="v${version}"

# Update the `uses:` reference in README.md to point at the new tag.
# Uses a perl one-liner so the in-place edit works portably on macOS.
perl -i -pe "s{(uses: mantasmatij/jira-release-link@).*}{\$1${tag}}" README.md

git add README.md

echo "Staged README.md update to ${tag}."
