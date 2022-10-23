const path = require("path");
const fs = require("fs");
const glob = require("glob");
const walkdir = require("walkdir");
const TruffleError = require("@truffle/error");

function isDirectoryEmpty(__dirname) {
  try {
    fs.readdirSync(__dirname);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return true;
    } else {
      throw err;
    }
  }
  return false;
}

const determineTestFilesToRun = async ({ inputFile, inputArgs = [], config }) => {
  let walkdirOptions = { follow_symlinks: true, find_links:true };
  let filesToRun = [];

  if (inputFile) {
    filesToRun.push(inputFile);
  } else if (inputArgs.length > 0) {
    for (let fileOrDir of inputArgs) {
      let results = await walkdir.async(fileOrDir, walkdirOptions, function(path, stat) {
           const isFile = fs.statSync(path).isFile();
           if(isFile){
               filesToRun.push(path);
           }
      }).catch((error) => {
        throw new TruffleError("\nError: %s\n", error);
      });
    }
  } else {
    if(!isDirectoryEmpty(config.test_directory)) {
      await walkdir.async(config.test_directory, walkdirOptions, function(path, stat) {
        const isFile = fs.statSync(path).isFile();
        if(isFile){
          filesToRun.push(path);
        }
      }).catch((error) => {
        throw new TruffleError("\nError: %s\n", error);
      });
    } else {
      throw new TruffleError("\nError: Test directory is empty.\n");
    }
  }

  return filesToRun.filter(file => {
    return file.match(config.test_file_extension_regexp) !== null;
  });
};

module.exports = {
  determineTestFilesToRun
};

