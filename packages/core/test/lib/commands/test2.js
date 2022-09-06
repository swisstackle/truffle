const { assert } = require("chai");
const {
    determineTestFilesToRun
} = require("../../../lib/commands/test/determineTestFilesToRun");
const path = require("path");
const fse = require("fs-extra");
const WorkflowCompile = require("@truffle/workflow-compile");
const Test = require("../../../lib/testing/Test");
const Config = require("@truffle/config");
const tmp = require("tmp");
const fs = require("fs");
let config;
let tempDir;

function updateFile(filename) {
    const fileToUpdate = path.resolve(
        path.join(config.contracts_directory, filename)
    );

    // Update the modification time to simulate an edit.
    const newTime = new Date().getTime();
    fse.utimesSync(fileToUpdate, newTime, newTime);
}

describe("test command", () => {
    before(function () {
        tempDir = tmp.dirSync({ unsafeCleanup: true });
        fse.copySync(path.join(__dirname, "../../sources/metacoin"), tempDir.name);
        config = new Config(undefined, tempDir.name);
    });

    //  Test with cycles and no missing directories, where all directories exist and all directories contain one or more files. Also, one file is outside the test directory but linked to it with a symlink inside the test directory.
    it("Check with cycles plus if it follows symlinks outside of the test directory.", async () => {
        // This allows to create customized directory structure to test more than one level of sub directories.
        let fileStructrure = {
            name: "sub_directory",
            files: ["test1.sol", "test2.js"],
            symlinks: [
                {
                    name: "symlink1",
                    src: path.join(config.test_directory, "sub_directory"),
                    destination: path.join(
                        config.test_directory,
                        "sub_directory",
                        "sub_sub_directory"
                    )
                },
                {
                    name: "symlink2",
                    src: path.join(
                        config.test_directory,
                        "sub_directory",
                        "sub_sub_directory"
                    ),
                    destination: path.join(config.test_directory, "sub_directory")
                },
                {
                    name: "symlink3",
                    src: path.join(config.test_directory, "sub_directory"),
                    destination: path.join("../../") // ../../random.sol testing whether it finds files outside of test directory through symlinks.
                }
            ],
            subdirs: [
                {
                    name: "sub_sub_directory",
                    files: ["test3.sol", "test4.js"]
                },
                {
                    name: "sub_sub_directory2",
                    files: ["test5.js", "test6.sol", "test7.sol"],
                    subdirs: [
                        {
                            name: "one_more_sub",
                            files: [
                                "test8.sol",
                                "test9.sol",
                                "test10.sol",
                                "test10.sol",
                                "test11.sol"
                            ]
                        },
                        {
                            name: "one_more_sub2",
                            files: [
                                "test12.sol",
                                "test13.sol",
                                "test14.sol",
                                "test14.sol",
                                "test15.sol"
                            ],
                            subdirs: [
                                {
                                    name: "solidity_only_subdir",
                                    files: ["test16.sol", "test17.sol", "test18.sol"]
                                },
                                {
                                    name: "js_only_subdir",
                                    files: ["test19.js", "test19.js", "test20.js"]
                                },
                                {
                                    name: "empty_sub_sub_directory",
                                    files: []
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // Create file in recursion. Used instead foreach since foreach loop doesn't wait for files to be created
        // Function does not count already existing files.
        function createFile(dirName, files, index) {
            // return zero if there are no files to create
            if (!files[index]) return 0;
            var fileName = path.join(dirName, files[index]);
            let filesCount = 0;
            if (!fse.existsSync(fileName)) {
                fse.createFileSync(fileName);
                filesCount++;
            }
            if (files.length > index + 1) {
                filesCount += createFile(dirName, files, index + 1);
            }

            return filesCount;
        }

        function createSymlinks(symlinks) {
            console.log(
                "Creating symlink: ",
                path.join(config.test_directory, "symlink"),
                " to ",
                path.join(config.test_directory, "testsub")
            );
            fs.symlink(
                symlinks.destination,
                path.join(symlinks.src, symlinks.name),
                err => {
                    console.log(err);
                }
            );
        }

        function createAFile(dirName, file) {
            var fileName = path.join(dirName, file);
            if (!fse.existsSync(fileName)) {
                fs.writeFileSync( fileName, "");
            }
        }

        // Create files using dirStruct object. Count newly created files and skip existing files.
        // Returns number of new files.
        function createTestSubDir(dirName, dirStruct, symlink) {
            var numOfFiles = 0;
            if (symlink) {
                createSymlinks(dirStruct);
            } else {
                numOfFiles = createFile(dirName, dirStruct.files, 0);
            }

            if (dirStruct.subdirs && !symlink) {
                dirStruct.subdirs.forEach(val => {
                    numOfFiles += createTestSubDir(
                        path.join(dirName, dirStruct.name, val.name),
                        val,
                        false
                    );
                });
            }
            if (dirStruct.symlinks) {
                dirStruct.symlinks.forEach(val => {
                    console.log(val.destination);
                    createTestSubDir(val.destination, val, true);
                });
            }
            return numOfFiles;
        }
        // Call method used by Test to discover existing test files. Then create subdirectories and test files in these
        // subdirectories. Then run Test method again and check if number discovered increased.
        let testFiles = determineTestFilesToRun({ config });
        const testFilesCount = testFiles.length;

        const newTestFiles = createTestSubDir(
            config.test_directory,
            fileStructrure
        );

        createAFile(path.join(config.test_directory, ".."), "random.sol");   // Create a file outside of test directory but linked to it with a symlink inside the test directory.
        console.log(config.test_directory);
        testFiles = determineTestFilesToRun({ config });
        assert.equal(
            testFiles.length,
            testFilesCount + newTestFiles + 1, // +1 because of the ../random.sol file that is outside of the test file structure.
            "Wrong number of files discovered."
        );
    });

    //  Test with no argument and empty directory
    it("No argument and empty directory.", async () => {
        let testFiles = determineTestFilesToRun({ config });
        assert.equal(testFiles.length, 0, "Non-existing file was detected.");
    });
}).timeout(1000);