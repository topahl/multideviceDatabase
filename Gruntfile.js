module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    jasmine : {
      src : 'src/**/*.js',
      options : {
        specs : 'spec/**/*.js',
        helpers: 'spec/*Helper.js',
        vendor: [
          'https://cdnjs.cloudflare.com/ajax/libs/dropbox.js/0.10.2/dropbox.min.js'
        ]
      }
    },

    'file-creator': {
      'basic': {
        'spec/DropboxAuthentificationHelper.js': function(fs, fd, done) {
          fs.writeSync(fd, "var APP_KEY = \"" + process.env.dropboxappkey + "\";localStorage.setItem('dropbox-auth:default:ydmWIAULjdTfJ4PP6ckdgdpsNLw', '{\"key\":\"p3dfgagtdigw9iz\",\"token\":\"" + process.env.dropboxtoken + "\",\"uid\":\"" + process.env.dropboxuid + "\"}' );");
          done();
        }
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-file-creator');

  grunt.registerTask('test', ['file-creator', 'jasmine']);

  grunt.registerTask('default', ['test']);
};
