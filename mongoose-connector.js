"use strict";
const mongoose = require('mongoose');
// Use native promises
mongoose.Promise = global.Promise;
// to set mongo_path, use something like:
// var mongo_path = process.env.MONGOLAB_URI ||
//     process.env.MONGOHQ_URL ||
//     configure.get('MONGO_PATH')
function connect(mongo_path, onError, done) {
    var done_called = false;
    function guardedDone(error) {
        if (!done_called) {
            done_called = true;
            done(error);
        }
    }
    var options = {
        server: { socketOptions: { keepAlive: 1 } }
    };
    mongoose.connect(mongo_path, options);
    // TODO: do we need to handle 'open' event?
    mongoose.connection.on('connected', function () {
        // console.log('mongoose connected, mongoose.connection.db.state=' + mongoose.connection.db.state)
        guardedDone();
    });
    mongoose.connection.on('error', function (error) {
        onError(error);
        console.log('Mongoose default connection error: ' + error);
    });
    mongoose.connection.on('disconnected', function () {
        // console.log('Mongoose default connection disconnected')
    });
    // TODO: correct mongoose.d.ts
    if (mongoose.connection.db['state'] === 'connected') {
        // TODO: state may not be supported in mongo 3.2
        guardedDone();
    }
}
exports.connect = connect;
function disconnect(done) {
    mongoose.connection.close(function () {
        // console.log('Mongoose disconnected')
        done();
    });
}
exports.disconnect = disconnect;
