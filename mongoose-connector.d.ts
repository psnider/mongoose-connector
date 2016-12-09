import mongoose                         = require('mongoose')

export function connect(mongo_path: string, onError : (error : Error) => void, done : (error? : Error) => void) : void
export function disconnect(done : (error? : Error) => void) : void
