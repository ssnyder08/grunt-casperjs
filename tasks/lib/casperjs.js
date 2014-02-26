var path = require('path');
var fs = require('fs');

exports.init = function(grunt) {
  var exports = {};

  exports.casperjs = function(filepath, options, callback) {

    var command = "./node_modules/.bin/casperjs";
    if (!fs.existsSync(command)) {
      grunt.log.error("CasperJS not found");
      command = path.join(__dirname, '..', '..', '..', 'casperjs', 'bin', 'casperjs');
    }
    var args = ['test'],
        spawn = require('child_process').spawn,
        phantomBinPath = require('phantomjs').path;

    if (options.casperjsOptions && options.casperjsOptions.length > 0) {
        args = args.concat(options.casperjsOptions);
    }

    args.push(filepath);

    grunt.log.writeln("Command: " + command);

    process.env["PHANTOMJS_EXECUTABLE"] = phantomBinPath;

    grunt.log.write('\nRunning tests from "' + filepath + '":\n');

    grunt.util.spawn({
      cmd: command,
      args: args,
      opts: {
        // pipe stdout/stderr through
        stdio: 'inherit'
      }
    }, function(error, stdout, code) {
      callback(error);
    });

  };

  return exports;
};
