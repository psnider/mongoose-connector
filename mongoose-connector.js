"use strict";
const mongoose = require('mongoose');
// Use native promises
mongoose.Promise = global.Promise;
const MODULE_NAME = 'mongoose-connector';
// Manages sharing of a default connection, so it appears to be mulitple connections to the users.
// This simplifies management of database connections, so that client code doesn't need to know about how other clients use the database.
class Connection {
    constructor(mongo_path, log) {
        this.mongo_path = mongo_path;
        this.log = log;
        this.state = 'disconnected';
        this.clients = [];
    }
    getIndexOfClient(client_name) {
        return this.clients.findIndex((client) => { return client.client_name === client_name; });
    }
    addClient(client) {
        console.log(`addClient client=${JSON.stringify(client)}`);
        let i = this.getIndexOfClient(client.client_name);
        if (i != -1) {
            this.clients[i] = client;
        }
        else {
            this.clients.push(client);
        }
    }
    connect(client) {
        let fname = 'Connection.connect';
        var done_called = false;
        let guardedDone = (error) => {
            if (!done_called) {
                done_called = true;
                this.connectDone(error);
            }
        };
        this.addClient(client);
        if (this.state === 'connected') {
            client.callbacks.connectDone();
        }
        else if (this.state === 'disconnecting') {
            client.callbacks.connectDone(new Error('cant connect while still disconnecting'));
        }
        else if (this.state === 'disconnected') {
            this.state = 'connecting';
            console.log(`Connection.connect this.state=${this.state}`);
            var options = {
                server: { socketOptions: { keepAlive: 1 } }
            };
            // TODO: replace this with separate mongoose connections, such as:
            // TODO: connection.clients.push(new Connection({onError, done}))
            mongoose.connect(this.mongo_path, options);
            // TODO: [handle the open event](https://github.com/psnider/mongoose-connector/issues/2)
            mongoose.connection.on('connected', () => {
                this.state = 'connected';
                console.log(`Connection.connect this.state=${this.state}`);
                this.log.info({ module: MODULE_NAME, fname, mongo_path: this.mongo_path, state: 'connected' });
                guardedDone();
            });
            mongoose.connection.on('error', (error) => {
                this.log.info({ module: MODULE_NAME, fname, mongo_path: this.mongo_path, 'mongoose.connection.db.state': mongoose.connection.db.state });
                this.onError(error);
            });
            mongoose.connection.on('disconnected', function () {
                this.state = 'disconnected';
                console.log(`Connection.connect this.state=${this.state}`);
                this.log.info({ module: MODULE_NAME, fname, mongo_path: this.mongo_path, state: 'disconnected' });
            });
            // TODO: [update mongoose.d.ts with mongoose.connection.db.state](https://github.com/psnider/mongoose-connector/issues/3)
            if (mongoose.connection.db['state'] === 'connected') {
                this.state = 'connected';
                console.log(`Connection.connect this.state=${this.state}`);
                guardedDone();
            }
        }
    }
    disconnect(done) {
        let fname = 'disconnect';
        this.state = 'disconnecting';
        console.log(`Connection.disconnect this.state=${this.state}`);
        mongoose.connection.close(() => {
            this.state = 'disconnected';
            console.log(`===Connection.disconnect this.state=${this.state}`);
            this.log.info({ module: MODULE_NAME, fname, mongo_path: this.mongo_path, state: 'disconnected' });
            console.log(`----`);
            done();
        });
    }
    connectDone(error) {
        this.clients.forEach((client) => {
            client.callbacks.connectDone(error);
        });
    }
    onError(error) {
        this.clients.forEach((client) => {
            client.callbacks.onError(error);
        });
    }
}
exports.Connection = Connection;
// This only supports the default connection,
// but is structured around independent connections, so it can be updated later.
class SharedConnections {
    constructor(log) {
        this.log = log;
        this.test_only = {
            getClientsCount: (client_name, mongo_path) => {
                let connection = this.connections[mongo_path];
                if (connection) {
                    return connection.clients.length;
                }
                else {
                    return 0;
                }
            }
        };
        this.connections = {};
    }
    // connect a client to a database.
    // @param client_name A unique name for the client of the database.
    // @param mongo_path The URL for the mongodb database.
    //    This must be a base URL, without any parameters.
    //    If you need parameters, then modify this function to take options.
    connect(client_name, mongo_path, callbacks) {
        let connection = this.connections[mongo_path];
        if (!connection) {
            if (Object.keys(this.connections).length !== 0) {
                throw new Error('SharedConnections only supports the default connection');
            }
            connection = new Connection(mongo_path, this.log);
            this.connections[mongo_path] = connection;
        }
        connection.connect({ client_name, callbacks });
    }
    // This disconnects all clients from the named database
    disconnectAll(done) {
        let done_count = 0;
        let done_called = false;
        let guardedDone = (error) => {
            console.log('guardedDone');
            ++done_count;
            if (!done_called && (error || (done_count === count))) {
                done_called = true;
                done(error);
            }
        };
        let mongo_paths = Object.keys(this.connections);
        let count = mongo_paths.length;
        Object.keys(this.connections).forEach((mongo_path) => {
            let connection = this.connections[mongo_path];
            connection.disconnect(guardedDone);
        });
    }
}
exports.SharedConnections = SharedConnections;
//# sourceMappingURL=mongoose-connector.js.map