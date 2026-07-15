#!/usr/bin/env bash
set -euo pipefail

# `version` is a pnpm lifecycle script: it runs after pnpm bumps package.json
# but before pnpm creates the version commit/tag. So here we only need to
# update README.md to point at the new tag and stage it for that commit.
#
# We point README at the major-version-only tag (e.g. `v3` instead of `v3.0.1`)
# so consumers always pick up the latest 3.x release. The major tag itself is
# moved to the new commit by scripts/postversion.sh after the commit is created.

major=$(node -p "require('./package.json').version.split('.')[0]")
major_tag="v${major}"

# Update the `uses:` reference in README.md to point at the major tag.
# Uses a perl one-liner so the in-place edit works portably on macOS.
perl -i -pe "s{(uses: mantasmatij/jira-release-link@).*}{\$1${major_tag}}" README.md

git add README.md

echo "Staged README.md update to ${major_tag}."
