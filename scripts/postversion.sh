#!/usr/bin/env bash
set -euo pipefail

# `postversion` is a pnpm lifecycle script: it runs after pnpm creates the
# version commit and the full tag (e.g. `v3.0.1`). Here we move the
# major-version-only tag (e.g. `v3`) to that commit so README's `uses:`
# reference keeps resolving to the latest 3.x release.

version=$(node -p "require('./package.json').version")
major=$(node -p "require('./package.json').version.split('.')[0]")
full_tag="v${version}"
major_tag="v${major}"

# Repoint the major tag at the new version commit, replacing any existing tag.
git tag -f "${major_tag}" HEAD

# Publish the new full tag and the (force-updated) major tag to the remote.
git push origin "${full_tag}"
git push -f origin "${major_tag}"

echo "Moved major tag ${major_tag} -> ${full_tag} and pushed to origin."
