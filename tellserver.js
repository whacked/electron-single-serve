const path = require("path");

var ARGV = process.argv.slice(2);
if(ARGV.length < 2) {
    console.info("example usage:");
    console.info("node " + path.basename(__filename) + " localhost:8000 https://localhost:8000/somewhere_else");
}

// serve_location is used to look up the ipc socket path;
// target_location is used to tell the electron browser where to go
var serve_location = ARGV[0],
    target_location = ARGV[1];

const APP_NAME = "elss-"+serve_location,
      socket_connector = require("node-ipc-socket-connector");

socket_connector.util.discover_socket_and_setup(APP_NAME,
    function(ipc_client, socket_id, data) {
        ipc_client.of[socket_id].emit(
            "loadurl",
            {
                id: path.basename(__filename),
                message: target_location
            }
        );
        ipc_client.disconnect(socket_id);
    }
);
