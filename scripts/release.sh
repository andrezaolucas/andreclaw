#!/bin/bash
# AndreClaw Release Script
# Uso: ./scripts/release.sh [patch|minor|major]
#
# Exemplos:
#   ./scripts/release.sh patch   # 1.0.0 -> 1.0.1
#   ./scripts/release.sh minor   # 1.0.0 -> 1.1.0
#   ./scripts/release.sh major   # 1.0.0 -> 2.0.0

set -e

BUMP_TYPE="${1:-patch}"

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Uso: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Versao atual: v${CURRENT_VERSION}"

# Calculate next version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
esac
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "Nova versao:   v${NEW_VERSION}"

# Confirm
read -p "Publicar v${NEW_VERSION}? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelado."
  exit 0
fi

# Update package.json locally
node -e "
  const pkg = require('./package.json');
  pkg.version = '${NEW_VERSION}';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Commit version bump
git add package.json
git commit -m "release: v${NEW_VERSION}"

# Create tag and push
git tag "v${NEW_VERSION}"
git push origin HEAD
git push origin "v${NEW_VERSION}"

echo ""
echo "Tag v${NEW_VERSION} criada e enviada!"
echo "O GitHub Actions vai buildar e publicar no npm automaticamente."
echo "Acompanhe em: https://github.com/andrelucas/andreclaw/actions"
