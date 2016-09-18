import mongoose                         = require('mongoose')

export function connect(mongo_path, onError : (error : Error) => void, done : (error? : Error) => void) : void
export function disconnect(done : (error? : Error) => void) : void
