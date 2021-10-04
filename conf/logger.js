
class Logger {
    constructor(logger){
        this.logger = logger;
    }

    _parseArguments(args){
        let message = '';
        for (const arg of args){
            if (typeof arg == 'object')
                message += JSON.stringify(arg) + ' ';
            else
                message += arg+ ' ';
        }

        return message;
    }

    debug(...args){
        this.logger.debug(this._parseArguments(args));
    }

    error(...args){
        this.logger.error(this._parseArguments(args));
    }

    verbose(...args){
        this.logger.verbose(this._parseArguments(args));
    }

    silly(...args){
        this.logger.silly(this._parseArguments(args));
    }

    warn(...args){
        this.logger.warn(this._parseArguments(args));
    }
    
    info(...args){
        this.logger.info(this._parseArguments(args));
    }
}

module.exports = Logger;