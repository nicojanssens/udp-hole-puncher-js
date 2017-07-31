const argv = require('yargs').argv;
const babelify = require('babelify');
const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const path = require('path');
const size = require('gulp-size');
const source = require('vinyl-source-stream');
const uglify = require('gulp-uglify');
const varify = require('varify');

let modules = {};
modules = {
  dgram: 'chrome-dgram',
  winston: 'winston-browser',
};

const bundle = (entry, replacements, destFile, destFolder, production) => {
  // set browserify options
  const options = {
    entries: entry,
    extensions: ['.js'],
    debug: !production,
  };
  // create bundler
  let bundler = browserify(options);
  // replace libs
  Object.keys(replacements).forEach((originalModule) => {
    bundler = bundler.require(
      replacements[originalModule],
      {
        expose: originalModule,
      } // eslint-disable-line comma-dangle
    );
  });
  // babelify transformation
  bundler.transform(
    babelify,
    {
      global: true,
      presets: ['es2015'],
    } // eslint-disable-line comma-dangle
  );
  // babelify transformation
  bundler.transform(
    varify,
    {
      global: true,
    } // eslint-disable-line comma-dangle
  );
  // bundle
  return bundler.bundle()
    .on('error', (err) => {
      console.log(err.toString());
      this.emit('end');
    })
    .pipe(source(destFile))
    .pipe(gulpif(production, buffer()))
    .pipe(gulpif(production, uglify()))
    .pipe(gulpif(production, size()))
    .pipe(gulp.dest(destFolder));
};

const browserifyTask = () => {
  const destFile = argv.production ? 'udp-hole-puncher.min.js' : 'udp-hole-puncher.debug.js';
  const destFolder = path.join(__dirname, 'build');
  const entry = path.join(__dirname, 'index.js');
  return bundle(entry, modules, destFile, destFolder, argv.production);
};

gulp.task('browserify', browserifyTask);

module.exports.bundle = bundle;
