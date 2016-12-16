import mongoose                         = require('mongoose')
// Use native promises
mongoose.Promise = global.Promise
import {Logger} from 'pino'


const MODULE_NAME = 'mongoose-connector'


interface Client {
    // this is a unique ID identifying the client
    client_name: string
    callbacks: {
        onError: (error : Error) => void
        connectDone : (error? : Error) => void
    }
}


type State = 'connecting' | 'connected' | 'disconnecting' | 'disconnected'


// Manages sharing of a default connection, so it appears to be mulitple connections to the users.
// This simplifies management of database connections, so that client code doesn't need to know about how other clients use the database.
export class Connection {

    state: State
    clients: Client[]

    constructor(private mongo_path: string, private log: Logger) {
        this.state ='disconnected'
        this.clients = []
    }

    getIndexOfClient(client_name: string): number {
        return this.clients.findIndex((client) => {return client.client_name === client_name})
    }

    addClient(client: Client) {
        let i = this.getIndexOfClient(client.client_name)
        if (i != -1) {
            this.clients[i] = client
        } else {
            this.clients.push(client)
        }
    }

    connect(client: Client) {
        let fname = 'Connection.connect'
        var done_called = false
        let guardedDone = (error? : Error) => {
            if (!done_called) {
                done_called = true
                this.connectDone(error)
            }
        }
        this.addClient(client)
        if (this.state === 'connected') {
            client.callbacks.connectDone()
        } else if (this.state === 'disconnecting') {
            client.callbacks.connectDone(new Error('cant connect while still disconnecting'))
        } else if (this.state === 'disconnected') {
            this.state = 'connecting'
            var options = {
                server: { socketOptions: { keepAlive: 1 } }
            }
            // TODO: replace this with separate mongoose connections, such as:
            // TODO: connection.clients.push(new Connection({onError, done}))
            mongoose.connect(this.mongo_path, options)
            // TODO: [handle the open event](https://github.com/psnider/mongoose-connector/issues/2)
            mongoose.connection.on('connected', () => {
                this.state = 'connected'
                this.log.info({module: MODULE_NAME, fname, mongo_path: this.mongo_path, state: 'connected'})
                guardedDone()
            })
            mongoose.connection.on('error', (error: Error) => {
                this.log.info({module: MODULE_NAME, fname, mongo_path: this.mongo_path, 'mongoose.connection.db.state': (<any>mongoose.connection.db).state})
                this.onError(error)
            })
            mongoose.connection.on('disconnected', () => {
                this.state = 'disconnected'
                this.log.info({module: MODULE_NAME, fname, mongo_path: this.mongo_path, state: 'disconnected'})
            })
            // TODO: [update mongoose.d.ts with mongoose.connection.db.state](https://github.com/psnider/mongoose-connector/issues/3)
            if ((<any>mongoose.connection.db)['state'] === 'connected') {
                this.state = 'connected'
                guardedDone()
            }
        }
    }


    disconnect(done : (error? : Error) => void): void {
        let fname = 'disconnect'
        this.state = 'disconnecting'
        mongoose.connection.close(() => {
            this.state = 'disconnected'
            this.log.info({module: MODULE_NAME, fname, mongo_path: this.mongo_path, state: 'disconnected'})
            done()
        })        
    }


    connectDone(error?: Error): void {
        this.clients.forEach((client) => {
            client.callbacks.connectDone(error)
        })
    }

    onError(error: Error): void {
        this.clients.forEach((client) => {
            client.callbacks.onError(error)
        })
    }

}



// This only supports the default connection,
// but is structured around independent connections, so it can be updated later.
export class SharedConnections {

    connections: {[mongo_path: string]: Connection}

    constructor(private log: Logger) {
        this.connections = {}
    }


    // connect a client to a database.
    // @param client_name A unique name for the client of the database.
    // @param mongo_path The URL for the mongodb database.
    //    This must be a base URL, without any parameters.
    //    If you need parameters, then modify this function to take options.
    connect(client_name: string, mongo_path: string, callbacks: {onError: (error : Error) => void, connectDone : (error? : Error) => void}) : void {
        let connection = this.connections[mongo_path]
        if (!connection) {
            if (Object.keys(this.connections).length !== 0) {
                throw new Error('SharedConnections only supports the default connection')
            }
            connection = new Connection(mongo_path, this.log)
            this.connections[mongo_path] = connection
        }
        connection.connect({client_name, callbacks})
    }


    // This disconnects all clients from the named database
    disconnectAll(done : (error? : Error) => void) : void {
        let done_count = 0
        let done_called = false
        let guardedDone = (error? : Error) => {
            ++done_count
            if (!done_called && (error || (done_count === count))) {
                done_called = true
                done(error)
            }
        }
        let mongo_paths = Object.keys(this.connections)
        let count = mongo_paths.length
        Object.keys(this.connections).forEach((mongo_path) => {
            let connection = this.connections[mongo_path]
            connection.disconnect(guardedDone)
        })
    }


    test_only = {
        getClientsCount: (client_name: string, mongo_path: string) => {
            let connection = this.connections[mongo_path]
            if (connection) {
                return connection.clients.length
            } else {
                return 0
            }
        }

    }
}




