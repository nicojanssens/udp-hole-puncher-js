'use strict'

var argv = require('yargs').argv
var browserify = require('browserify')
var buffer = require('vinyl-buffer')
var gulp = require('gulp')
var gulpif = require('gulp-if')
var path = require('path')
var size = require('gulp-size')
var source = require('vinyl-source-stream')
var uglify = require('gulp-uglify')

var modules = {}
modules.chromiumify = {
  'dgram': 'chrome-dgram',
  'winston': './lib/logger'
}
modules.cordovaify = {
  'winston': './lib/logger'
}

gulp.task('chromiumify', function () {
  var destFile = argv.production? 'udp-hole-puncher.min.js': 'udp-hole-puncher.debug.js'
  var destFolder = path.join(__dirname, 'build/chromium')
  var entry = path.join(__dirname, 'index.js')
  return bundle(entry, modules.chromiumify, destFile, destFolder, argv.production)
})

gulp.task('cordovaify', function () {
  var destFile = argv.production? 'udp-hole-puncher.min.js': 'udp-hole-puncher.debug.js'
  var destFolder = path.join(__dirname, 'build/cordova')
  var entry = path.join(__dirname, 'index.js')
  return bundle(entry, modules.cordovaify, destFile, destFolder, argv.production)
})

function bundle(entry, replacements, destFile, destFolder, production) {
  var options = {
    entries: entry,
    extensions: ['.js'],
    debug: production ? false : true
  }
  var bundler = browserify(options)
  for (var originalModule in replacements) {
    var replacementModule = replacements[originalModule]
    bundler = bundler.require(originalModule, {
       expose: replacementModule
    })
  }
  return bundler.bundle()
    .on('error', function (err) {
      console.log(err.toString());
      this.emit('end');
    })
    .pipe(source(destFile))
    .pipe(gulpif(argv.production, buffer()))
    .pipe(gulpif(argv.production, uglify()))
    .pipe(gulpif(argv.production, size()))
    .pipe(gulp.dest(destFolder))
}

module.exports.bundle = bundle
module.exports.modules = modules
