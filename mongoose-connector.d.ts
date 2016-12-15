import mongoose                         = require('mongoose')
import {Logger} from 'pino'

export function connect(mongo_path: string, onError : (error : Error) => void, done : (error? : Error) => void) : void
export function disconnect(done : (error? : Error) => void) : void


export class SharedConnections {

    constructor(log: Logger)

    // connect a client to a database.
    // @param client_name A unique name for the client of the database.
    // @param mongo_path The URL for the mongodb database.
    //    This must be a base URL, without any parameters.
    //    If you need parameters, then modify this function to take options.
    connect(client_name: string, mongo_path: string, callbacks: {onError: (error : Error) => void, connectDone : (error? : Error) => void}) : void


    // This disconnects all clients from the named database
    disconnectAll(done : (error? : Error) => void) : void

    test_only: {
        getClientsCount: (client_name: string, mongo_path: string) => number
    }

}

