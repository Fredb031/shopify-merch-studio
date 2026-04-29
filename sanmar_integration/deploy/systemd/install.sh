#!/bin/bash
# Install the SanMar nightly sync timer + service into systemd.
#
# Pre-reqs:
#   - /opt/sanmar checkout with the package installed in .venv
#   - /opt/sanmar/.env populated from .env.example
#   - a `sanmar` system user owning /opt/sanmar
#
# Usage:
#   sudo ./install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sudo cp "${SCRIPT_DIR}/sanmar-nightly.service" /etc/systemd/system/
sudo cp "${SCRIPT_DIR}/sanmar-nightly.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sanmar-nightly.timer
sudo systemctl status sanmar-nightly.timer
