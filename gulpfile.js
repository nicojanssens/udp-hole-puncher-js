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
var varify = require('varify')

var modules = {}
modules = {
  'dgram': 'chrome-dgram',
  'winston': 'winston-browser'
}

gulp.task('browserify', browserifyTask)

function browserifyTask() {
  var destFile = argv.production? 'udp-hole-puncher.min.js': 'udp-hole-puncher.debug.js'
  var destFolder = path.join(__dirname, 'build')
  var entry = path.join(__dirname, 'index.js')
  return bundle(entry, modules, destFile, destFolder, argv.production)
}

function bundle(entry, replacements, destFile, destFolder, production) {
  // set browserify options
  var options = {
    entries: entry,
    extensions: ['.js'],
    debug: production ? false : true
  }
  // create bundler
  var bundler = browserify(options)
  // replace libs
  for (var originalModule in replacements) {
    var replacementModule = replacements[originalModule]
    bundler = bundler.require(replacementModule, {
       expose: originalModule
    })
  }
  // babelify transformation
  bundler.transform(
    varify, {
      global: true
    }
  )
  // bundle
  return bundler.bundle()
    .on('error', function (err) {
      console.log(err.toString());
      this.emit('end');
    })
    .pipe(source(destFile))
    .pipe(gulpif(production, buffer()))
    .pipe(gulpif(production, uglify()))
    .pipe(gulpif(production, size()))
    .pipe(gulp.dest(destFolder))
}

module.exports.bundle = bundle
