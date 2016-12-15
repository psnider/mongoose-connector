"use strict";
const chai = require('chai');
var expect = chai.expect;
const mongoose = require('mongoose');
const pino = require('pino');
const mongoose_connector_1 = require('@sabbatical/mongoose-connector');
var log = pino();
var MockMongooseDefaultConnection;
(function (MockMongooseDefaultConnection) {
    var actions = [];
    var mongo_path;
    function mock() {
        mongoose.connect = connect;
        mongoose.connection = connection;
        if (!mongoose.connection.is_mock)
            throw new Error('mock missing is_mock');
    }
    MockMongooseDefaultConnection.mock = mock;
    function reset(test_actions) {
        actions = test_actions;
        MockMongooseDefaultConnection.connect_called = 0;
        MockMongooseDefaultConnection.disconnect_called = 0;
        mongo_path = undefined;
        connection.handlers = {};
        connection.db.state = 'disconnected';
    }
    MockMongooseDefaultConnection.reset = reset;
    function takeAction(done) {
        let action = actions.shift();
        if (action) {
            if (action.event && connection.handlers[action.event]) {
                console.log(`mock takeAction call ${action.event}`);
                connection.handlers[action.event](action.error);
            }
            if (action.call_done && done) {
                console.log(`mock takeAction call done`);
                done(action.error);
            }
        }
    }
    function connect(target_mongo_path, options) {
        ++MockMongooseDefaultConnection.connect_called;
        console.log(`mock.connect called ${MockMongooseDefaultConnection.connect_called} times`);
        if (!mongo_path) {
            mongo_path = target_mongo_path;
        }
        else {
            if (mongo_path != target_mongo_path) {
                throw new Error('MockMongooseDefaultConnection only supports one connection');
            }
        }
        connection.db.state = 'connected';
        console.log(`mock.connect connection.db.state=${connection.db.state}`);
        takeAction();
        console.log(`mock.connect done`);
    }
    function disconnect(done) {
        if (connection.db.state !== 'disconnected') {
            ++MockMongooseDefaultConnection.disconnect_called;
            console.log(`mock.disconnect called ${MockMongooseDefaultConnection.disconnect_called} times`);
            if (!mongo_path) {
                throw new Error('disconnect mongo_path isnt set');
            }
            connection.db.state = 'disconnected';
            console.log(`mock.disconnect connection.db.state=${connection.db.state}`);
            takeAction(done);
            mongo_path = undefined;
        }
        else {
            takeAction(done);
        }
    }
    var connection = {
        is_mock: true,
        handlers: {},
        on: (event, handler) => {
            console.log(`set mock.connection.on(${event}, handler)`);
            connection.handlers[event] = handler;
        },
        close: disconnect,
        db: {
            state: 'disconnected'
        }
    };
})(MockMongooseDefaultConnection || (MockMongooseDefaultConnection = {}));
describe('SharedConnections', function () {
    const MONGO_PATH = 'localhost:17016/test';
    before(function () {
        MockMongooseDefaultConnection.mock();
    });
    describe('connect()', function () {
        describe('for first client', function () {
            it('should connect to mongoose', function (done) {
                MockMongooseDefaultConnection.reset([]);
                let shared = new mongoose_connector_1.SharedConnections(log);
                shared.connect('a', MONGO_PATH, {
                    onError: (error) => {
                        done(error);
                    }, connectDone: (error) => {
                        expect(error).to.not.exist;
                        expect(MockMongooseDefaultConnection.connect_called).to.equal(1);
                        done();
                    }
                });
            });
        });
        describe('for second client', function () {
            it('should not connect to mongoose', function (done) {
                debugger;
                MockMongooseDefaultConnection.reset([{ event: 'connected' }]);
                let shared = new mongoose_connector_1.SharedConnections(log);
                shared.connect('a', MONGO_PATH, {
                    onError: (error) => {
                        done(error);
                    }, connectDone: (error) => {
                        expect(MockMongooseDefaultConnection.connect_called).to.equal(1);
                        shared.connect('b', MONGO_PATH, {
                            onError: (error) => {
                                done(error);
                            }, connectDone: (error) => {
                                console.log(`connectDone called`);
                                // expect no change
                                expect(MockMongooseDefaultConnection.connect_called).to.equal(1);
                                done();
                            }
                        });
                    }
                });
            });
            it('should not add another client if the client_name is the same', function (done) {
                MockMongooseDefaultConnection.reset([{ event: 'connected' }]);
                let shared = new mongoose_connector_1.SharedConnections(log);
                shared.connect('a', MONGO_PATH, {
                    onError: (error) => {
                        done(error);
                    }, connectDone: (error) => {
                        expect(MockMongooseDefaultConnection.connect_called).to.equal(1);
                        expect(shared.test_only.getClientsCount('a', MONGO_PATH)).to.equal(1);
                        shared.connect('a', MONGO_PATH, {
                            onError: (error) => {
                                done(error);
                            }, connectDone: (error) => {
                                // expect no change
                                expect(MockMongooseDefaultConnection.connect_called).to.equal(1);
                                expect(shared.test_only.getClientsCount('a', MONGO_PATH)).to.equal(1);
                                done();
                            }
                        });
                    }
                });
            });
        });
    });
    describe('disconnectAll()', function () {
        it('should disconnect multiple clients', function (done) {
            MockMongooseDefaultConnection.reset([{ call_done: true }, { call_done: true }]);
            let shared = new mongoose_connector_1.SharedConnections(log);
            shared.connect('a', MONGO_PATH, {
                onError: (error) => {
                    done(error);
                }, connectDone: (error) => {
                    expect(MockMongooseDefaultConnection.connect_called).to.equal(1);
                    expect(shared.test_only.getClientsCount('a', MONGO_PATH)).to.equal(1);
                    shared.connect('b', MONGO_PATH, {
                        onError: (error) => {
                            done(error);
                        }, connectDone: (error) => {
                            expect(error).to.not.exist;
                            shared.disconnectAll((error) => {
                                expect(error).to.not.exist;
                                expect(MockMongooseDefaultConnection.disconnect_called).to.equal(1);
                                done();
                            });
                        }
                    });
                }
            });
        });
    });
});
//# sourceMappingURL=mongoose-connector.tests.js.map