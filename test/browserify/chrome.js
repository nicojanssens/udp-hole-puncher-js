'use strict'

var cp = require('child_process')
var path = require('path')
var os = require('os')

var CHROME = process.env.CHROME

// locate default chromes for os
switch (os.platform()) {
  case 'win32':
    if (process.arch === 'x64') {
      CHROME = '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"'
    } else {
      CHROME = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
    }
    break
  case 'darwin':
    CHROME = '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome'
    break
  case 'linux':
    CHROME = '/opt/google/chrome/chrome'
    break
  default:
    console.log('Defaulting to process.env.CHROME `%s`', process.env.CHROME)
    break
}

exports.launchApp = function () {
  // supply full path because windows
  var app = path.join(__dirname, '/chrome-app')

  var command = CHROME + ' --load-and-launch-app=' + app
  if (os.platform() === 'darwin' || os.platform() === 'linux') {
    command += ' > /dev/null 2>&1'
  }
  var env = { cwd: path.join(__dirname, '..') }

  return cp.exec(command, env, function (err) {
    if (err) throw err
  })
}
