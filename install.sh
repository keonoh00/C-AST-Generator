#!/usr/bin/env bash
set -euo pipefail

# Usage: sudo ./install-tools.sh [--reinstall]
REINSTALL=false
[[ "${1-:-}" == "--reinstall" ]] && REINSTALL=true

# 1) Prerequisites
echo "→ Installing APT dependencies"
apt-get update
apt-get install -y --no-install-recommends default-jdk git unzip wget curl
rm -rf /var/lib/apt/lists/*

# 2) Joern v4.0.361
JOERN_VERSION="4.0.361"
JOERN_URL="https://github.com/joernio/joern/releases/download/v${JOERN_VERSION}/joern-cli.zip"
JOERN_BASE="/opt/joern/joern-cli"
JOERN_BIN="${JOERN_BASE}/joern"
JOERN_JAR="${JOERN_BASE}/lib/io.joern.joern-cli-${JOERN_VERSION}.jar"

if [[ -x "$JOERN_BIN" && -f "$JOERN_JAR" && "$REINSTALL" != true ]]; then
  echo "✓ Joern ${JOERN_VERSION} already installed (jar present)"
else
  echo "→ Installing Joern ${JOERN_VERSION}"
  rm -rf "/opt/joern" /usr/local/bin/joern
  mkdir -p "$(dirname "$JOERN_BASE")"
  wget --show-progress "$JOERN_URL" -O /tmp/joern-cli.zip
  unzip -q /tmp/joern-cli.zip -d /opt/joern
  ln -sf "$JOERN_BIN" /usr/local/bin/joern
  echo "✓ Joern installed to $JOERN_BASE"
fi

# 3) Ghidra 11.4_PUBLIC
GHIDRA_TAG="Ghidra_11.4_build"
GH_API="https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/tags/${GHIDRA_TAG}"
INSTALL_BASE="/opt"

# locate existing Ghidra install (any suffix)
EXIST_GH=$(find "$INSTALL_BASE" -maxdepth 1 -type d -name "ghidra_11.4_PUBLIC*" | head -n1 || true)

if [[ -n "$EXIST_GH" && "$REINSTALL" != true ]]; then
  echo "✓ Ghidra already installed at $(basename "$EXIST_GH")"
else
  echo "→ Resolving Ghidra download URL"
  GH_URL=$(curl -s "$GH_API" \
    | grep '"browser_download_url":' \
    | grep '.zip"' \
    | head -n1 \
    | cut -d '"' -f4)
  echo "→ Downloading Ghidra"
  rm -rf "${INSTALL_BASE}/ghidra_11.4_PUBLIC*" /usr/local/bin/ghidra
  wget --show-progress "$GH_URL" -O /tmp/ghidra.zip
  unzip -q /tmp/ghidra.zip -d "$INSTALL_BASE"
  EXIST_GH=$(find "$INSTALL_BASE" -maxdepth 1 -type d -name "ghidra_11.4_PUBLIC*" | head -n1)
  chmod +x "$EXIST_GH/ghidraRun"
  echo "✓ Ghidra installed to $(basename "$EXIST_GH")"
fi

# 4) Ensure ghidra symlink always exists
if [[ -n "$EXIST_GH" ]]; then
  ln -sf "$EXIST_GH/ghidraRun" /usr/local/bin/ghidra
  # Register headless analyzer globally
  sudo ln -sf "$EXIST_GH/support/analyzeHeadless" /usr/local/bin/ghidraHeadless
  sudo chmod +x /usr/local/bin/ghidraHeadless
fi

# 5) Verification
echo "→ Verifying installations"
if command -v joern &>/dev/null; then
  echo "  • joern → $(command -v joern)"
else
  echo "✗ joern missing" >&2
  exit 1
fi

if command -v ghidra &>/dev/null; then
  echo "  • ghidra → $(command -v ghidra)"
else
  echo "✗ ghidra missing" >&2
  exit 1
fi

echo -e "
🎉 All set! You can now run 'joern', 'ghidra', and 'ghidraHeadless' from any shell."