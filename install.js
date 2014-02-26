'use strict'

var cp = require('child_process');
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var url = require('url');
var rimraf = require('rimraf').sync;
var AdmZip = require('adm-zip');
var npmconf = require('npmconf');
var kew = require('kew');
var tunnel = require('tunnel');

fs.existsSync = fs.existsSync || path.existsSync

var libPath = path.join(__dirname, 'lib', 'casperjs');
var tmpPath = path.join(__dirname, 'tmp');
var version = '1.1-beta3';
var downloadUrl = 'https://github.com/n1k0/casperjs/archive/' + version + '.zip';



function isCasperInstalled(notInstalledCallback) {
    // Note that "which" doesn't work on windows.
    cp.exec("casperjs --version", function(error, stdout, stderr) {
        if ( error ) {
            console.log("Casperjs not installed.  Installing.");
            notInstalledCallback();
        } else {
            var casperVersion = stdout.replace(/^\s+|\s+$/g,'');
            cp.exec("casperjs '" + path.join(__dirname, "tasks", "lib", "casperjs-path.js") + "'", function(error, stdout, stderr) {
                var casperPath = stdout.replace(/^\s+|\s+$/g,'');
                console.log("Casperjs version " + casperVersion + " installed at " + casperPath);
                var casperExecutable = path.join(casperPath, "bin", "casperjs");
                fs.symlinkSync(casperExecutable, './casperjs');
            });
        }
    });
}

function tidyUp() {
    console.log("Tidying up.");
    rimraf(tmpPath);
    console.log("Finished tidy.");
}

function unzipTheZippedFile() {
    console.log('Attemping to unzip the file.');
    var zip = new AdmZip(path.join(tmpPath, 'archive.zip'));
    zip.extractAllTo(libPath, true);
    console.log('Extracted contents.');
    if (process.platform != 'win32') {
        console.log('Creating symlinks.');
        var pathToCommand = path.join(libPath, 'casperjs-' + version, 'bin', 'casperjs');
        fs.symlinkSync(pathToCommand, './casperjs');
        console.log('Created symlink and statting file.');
        var stat = fs.statSync(pathToCommand);
        if (!(stat.mode & 64)) {
            console.log('Performing chmod on file.');
            fs.chmodSync(pathToCommand, '755');
            console.log('Finished chmod on file.');
        }
    }
    console.log('Calling tidy.');
    tidyUp();
}

function downloadZipFromGithub() {
    console.log('Attemping to download the zip from github');
    var file = fs.createWriteStream(path.join(tmpPath, "archive.zip"));
    var lengthSoFar = 0;
    var npmconfDeferred = kew.defer()
    npmconf.load(npmconfDeferred.makeNodeResolver())
    npmconfDeferred.promise.then(function (conf) {
        console.log('Got configuration');
        var request = https.get(getProxyOptions(conf.get('proxy')), function(response) {
                console.log('Performing http get');
                if (response.statusCode === 301 || response.statusCode === 302) {
                    console.log("Received an error response code: "+response.statusCode);
                    downloadUrl = response.headers.location;
                    downloadZipFromGithub();
                } else {
                    response.pipe(file);
                    response.on('data', function(chunk) {
                        console.log('Receiving ' + Math.floor((lengthSoFar += chunk.length) / 1024) + 'K...' );
                    }).
                        on('end', unzipTheZippedFile).
                        on('error', function(e) {
                            console.log('An error occured whilst trying to download Casper.JS ' + e.message);
                            tidyUp();
                        });
                }
            });
            request.on('error', function(e) {
                console.log('An error occured whilst trying to download Casper.JS ' + e.message);
                tidyUp();
            });
    });

}

function getProxyOptions(proxyUrl) {
    if (proxyUrl) {
        console.log('Found proxy url: '+proxyUrl);
        var proxyOptions = url.parse(proxyUrl);
        var options = url.parse(downloadUrl);

        var tunnelingAgent = tunnel.httpsOverHttp({
            rejectUnauthorized: false,

            proxy: { // Proxy settings
                host: proxyOptions.hostname, // Defaults to 'localhost'
                port: proxyOptions.port, // Defaults to 80

                // Basic authorization for proxy server if necessary
                proxyAuth: proxyOptions.auth,

                // Header fields for proxy server if necessary
                headers: {
                    'User-Agent': 'curl/7.21.4 (universal-apple-darwin11.0) libcurl/7.21.4 OpenSSL/0.9.8r zlib/1.2.5'
                }
            }
        });

        tunnelingAgent.rejectUnauthorized = false;
        options.agent = tunnelingAgent;
        options.path = downloadUrl;
        options.headers = { Host: url.parse(downloadUrl).host };
        console.log('Setting up connection to host: '+options.headers.Host);
        console.log('Downloading from: '+options.path);
        options.headers['User-Agent'] = 'curl/7.21.4 (universal-apple-darwin11.0) libcurl/7.21.4 OpenSSL/0.9.8r zlib/1.2.5';
        if (options.auth) {
            options.headers['Proxy-Authorization'] = 'Basic ' + new Buffer(options.auth).toString('base64');
            delete options.auth;
        }

        console.log('Returning options');
        return options;
    } else {
        return url.parse(downloadUrl);
    }
}

isCasperInstalled(function() {
    if (!fs.existsSync(tmpPath)) {
        fs.mkdirSync(tmpPath);
    }
    rimraf(libPath);

    downloadZipFromGithub();
});
