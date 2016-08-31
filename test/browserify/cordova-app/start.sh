#!/bin/bash

cordova platform add ios
cordova plugin add --save https://github.com/MobileChromeApps/cordova-plugin-chrome-apps-sockets-udp
cordova build ios
cordova emulate ios
