// include gulp
var gulp = require('gulp');

// include plugins
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var streamify = require('gulp-streamify');
var uglify = require('gulp-uglify');
var util = require('gulp-util');

// base paths
var paths = {
	src: {
		js: 'src/'
	},
	dist: {
		js: 'dist/'
	}
};
var fileNameBase = 'fileDB';

// JS build file lists
var jsFiles = [
	paths.src.js + 'File.js',
	paths.src.js + 'Table.js',
	paths.src.js + 'FileDB.js'
];

// build ES to JS
gulp.task('scripts:bundle', function() {
	return gulp.src(jsFiles)
		.pipe(babel())
		.pipe(concat(fileNameBase + '.js'))
		.pipe(gulp.dest(paths.dist.js))
		.on('error', util.log);
});

// distribution build, uglified
gulp.task('scripts:build', ['scripts:bundle'], function() {
	return gulp.src(paths.dist.js + fileNameBase + '.js')
		.pipe(rename({
      suffix: ".min"
    }))
		.pipe(streamify(uglify()))
		.pipe(gulp.dest(paths.dist.js))
		.on('error', util.log);
});

// full JS build
gulp.task('scripts:default', ['scripts:bundle', 'scripts:build']);

// watch files for changes
gulp.task('watch', function() {
	gulp.watch(paths.src.js + '**/*.js', ['scripts:bundle']);
});

// Default Task
gulp.task('default', ['scripts:default']);
