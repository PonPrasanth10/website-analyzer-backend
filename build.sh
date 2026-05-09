#!/bin/bash

# Install Chrome for Puppeteer on Render
echo "Installing Chrome for Puppeteer..."

# Install Chrome
curl -sSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o chrome.deb
dpkg -i chrome.deb || apt-get install -yf
rm chrome.deb

# Install dependencies
npm install

echo "Build complete!"