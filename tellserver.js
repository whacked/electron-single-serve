var ARGV = process.argv.slice(2);
if(ARGV.length < 1) {
    console.info("need an argument");
    process.exit();
}

const APP_NAME = "electron-single-serve",
      path = require("path"),
      socket_connector = require("node-ipc-socket-connector");

socket_connector.util.discover_socket_and_setup(APP_NAME,
    function(ipc_client, socket_id, data) {
        console.log("CONNECTED!!!")
        ipc_client.of[socket_id].emit(
            "loadurl",
            {
                id: path.basename(__filename),
                message: ARGV[0]
            }
        );
        ipc_client.disconnect(socket_id);
    }
);
