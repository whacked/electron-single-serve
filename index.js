const path = require("path"),
      url = require("url"),
      electronLocalshortcut = require('electron-localshortcut'),
      {app, remote, BrowserWindow, ipcMain} = require("electron"),
      {spawn} = require("child_process"),
      searchInPage = require("electron-in-page-search").default,
      http = require("http");

var VERBOSITY = 11;

const APP_NAME_PREFIX = 'elss-';

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

var globals = {};

///////////////
// main proc //
///////////////

// PARSE CLI ARGS
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

const APP_NAME = APP_NAME_PREFIX+host+':'+port;


// ELECTRON SETUP
app.on("window-all-closed", function() {
    app.quit();
});

app.on("ready", function() {

    var childProc = new ChildProcess();
    childProc.start(cmd, cmdArgs);

    var browserInitialized = false;
    function initMain() {
        if(browserInitialized) {
            return;
        }
        browserInitialized = true;
        var mainWindow = new BrowserWindow({});
        globals.mainWindow = mainWindow;
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

// <ipc server setup>
const socket_connector = require("node-ipc-socket-connector");
const ipc = require("node-ipc"),
      fs = require("fs");

socket_connector.util.ipc_set_default_config(ipc.config);
socket_connector.util.ensure_socket_master_dir(APP_NAME)
ipc.config.appspace = APP_NAME;
ipc.config.socketRoot = socket_connector.util.make_socket_root(APP_NAME);

ipc.serve(
        ipc.config.socketRoot,
        () => {
            ipc.server.on(
                "get:appidentity",
                (data, socket) => {
                    ipc.server.emit(socket,
                        "appidentity",
                        {
                            id: ipc.config.id,
                            message: APP_NAME
                        }
                    );
                }
            );
            ipc.server.on(
                "loadurl",
                (data, socket) => {
                    globals.mainWindow.webContents.send("loadurl", data.message);
                }
            );
});

new Array("SIGINT", "exit")
        .forEach(evtname => {
    process.on(evtname, () => {
        var spath = ipc.config.socketRoot;
        if(fs.existsSync(spath)) {
            fs.unlinkSync(spath);
        }
        process.exit();
    });
})

ipc.server.start();
// </ipc server>
