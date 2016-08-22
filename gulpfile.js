'use strict'

var argv = require('yargs').argv
var browserify = require('browserify')
var buffer = require('vinyl-buffer')
var gulp = require('gulp')
var gulpif = require('gulp-if')
var rename = require('gulp-rename')
var size = require('gulp-size')
var source = require('vinyl-source-stream')
var uglify = require('gulp-uglify')

var modules = {}
modules.chromiumify = {
  'dgram': 'chrome-dgram',
  'winston': './lib/logger'
}

gulp.task('chromiumify', function () {
  var modules = {
    'dgram': 'chrome-dgram',
    'winston': './lib/logger'
  }
  var options = {
    entries: './index.js',
    extensions: ['.js'],
    debug: argv.production ? false : true,
    require: modules.chromiumify
  }
  var bundler = browserify(options)
  var destFile = argv.production? 'udp-hole-puncher.min.js': 'udp-hole-puncher.debug.js'
  var destFolder = './build/chromium'
  bundler.bundle()
    .pipe(source('index.js'))
    .pipe(gulpif(argv.production, buffer()))
    .pipe(gulpif(argv.production, uglify()))
    .pipe(gulpif(argv.production, size()))
    .pipe(rename(destFile))
    .pipe(gulp.dest(destFolder))
})
