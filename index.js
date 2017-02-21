const {app, remote, BrowserWindow, ipcMain} = require("electron");
const electronLocalshortcut = require('electron-localshortcut');
const {spawn} = require("child_process");
const path = require("path");
const url = require("url");
const http = require("http");
const searchInPage = require("electron-in-page-search").default; 
var VERBOSITY = 11;

function ChildProcess() {
    var self = this;
    self.handle = null;
    self.start = function(cmd, args) {
        console.info("LAUNCHING: " + cmd + " " + args.join(" "));
        self.handle = spawn(cmd, args || [], {detached:true});
        
        self.handle.stdout.on("data", function(data) {
            VERBOSITY > 0 && process.stdout.write(data);
        });
        self.handle.stderr.on("data", function(data) {
            VERBOSITY > 0 && process.stderr.write(data);
        });
        self.handle.on("close", function(data) {
            VERBOSITY > 0 && console.log("child proc exiting...");
            self.handle = null;
        });
    };
    self.kill = function() {
        if(self.handle) {
            process.kill(-self.handle.pid)
            self.handle = null;
        }
    };
}

app.on("window-all-closed", function() {
    app.quit();
});

app.on("ready", function() {

    // first is running binary, second is script;
    // for electron, first is path to electron,
    // second is *probably* '.' = PWD
    var ARGV = process.argv.slice(2);
    if(ARGV.length < 3) {
        console.info("usage: URL CMD [ARG1 ARG2 ...]\n");
        console.info("full example: electron . http://localhost:8000 python -m SimpleHTTPServer\n");
        process.exit();
    }

    const urlMatcher = /(http|https):\/\/([^:]+)(?:\:(\d+))?/;

	urlMatch = ARGV[0].match(urlMatcher);
    if(!urlMatch) {
        console.info("did not recognize '"+ARGV[0]+"' as a valid URL");
        process.exit();
    }

    var location = urlMatch[0],
        protocol = urlMatch[1],
        host     = urlMatch[2],
        port     = urlMatch[3];
    var cmd = ARGV[1],
        cmdArgs = ARGV.slice(2);

    var childProc = new ChildProcess();
    childProc.start(cmd, cmdArgs);

    var browserInitialized = false;
    function initMain() {
        if(browserInitialized) {
            return;
        }
        browserInitialized = true;
        var mainWindow = new BrowserWindow({});
        indexhtml = url.format({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file:",
            slashes: true
        });
        mainWindow.loadURL(indexhtml);
        mainWindow.webContents.openDevTools();
        mainWindow.on("closed", function() {
            childProc.kill();
        });
        mainWindow.webContents.on("did-finish-load", function() {
            mainWindow.webContents.send("loadurl", location);
        });

        electronLocalshortcut.register(mainWindow, "CommandOrControl+S", function() {
            mainWindow.webContents.send("trigger", "startsearch");
        });
        electronLocalshortcut.register(mainWindow, "CommandOrControl+X", function() {
            mainWindow.webContents.send("trigger", "stopsearch");
        })
    }

    var checkHandle = setInterval(function() {
        http.get({
		    host: host, 
		    port: port 
		}, function(res) {
            VERBOSITY > 10 && console.log("connected.");
            clearInterval(checkHandle);
            initMain();
		}).on("error", function() {
            VERBOSITY > 10 && console.log("waiting for connection...");
        });
    }, 1000);
});
