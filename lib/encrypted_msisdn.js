
const redis = require('./redis_wrapper');
redis.init();
const Oracle = require('./oracle');
const serviceFinder = require('../conf/di');

const logger = serviceFinder.get('logger');

const ttl = 2629746 //2629746 one month  duration of data in redis


const Sanitizer = require('./sanitizer');

const encryptMsisdnProcedureName = 'subs_consolidated_msisdn';
const decryptMsisdnProcedureName = 'subs_consolidated_encrypted';


class EncryptedMSISDN{

    /**
     *
     * @param {string} msisdn
     * @param {boolean} [encrypted = true] Is the value being passed the encrypted from or not
     */
    constructor(msisdn, encrypted = true){
        if (encrypted)
            this.encrypted = msisdn;
        else
            this.decrypted = Sanitizer.normalizeMSISDN(msisdn);
    }

    /**
     * Attempt to retrieve saved 'decrypted MSISDN' from redis
     * If not present, retrieve decrypted form form bluechip
     * @returns {string} the decrypted MSISDN
     */
    async getMsisdn(){
        return await redis.get_async('encrypted_msisdn_'+this.encrypted) || await this.decrypt();
    }

     /**
     * Attempt to retrieve saved 'encrypted MSISDN' from redis
     * If not present, retrieve encrypted form form bluechip
     * @returns {string} the encrypted MSISDN
     */
    async getEncryptedMsisdn(){
      return await redis.get_async('decrypted_msisdn_'+this.decrypted) || await this.encrypt();
    }

    /**
     * Decrypt MSISDN with bluechip and save decrypted form to redis
     * @param {boolean} [save = true] Persist to redis or not. Default is true
     * @return {string} the decrypted form
     */
    async decrypt(save = true){

        this.decrypted = await Oracle.callDecrpytMsisdn(this.encrypted);

        if (save){
            //save to redis
            const key = 'encrypted_msisdn_'+this.encrypted;

            await redis.set_async(key, this.decrypted)

            redis.expire(key, ttl); // ttl of 1 month
        }

        return this.decrypted;

    }

    /**
     * Encrypt MSISDN if {this.decrypted} is already known and save e
     * @param {boolean} [save = true] Persist to redis or not. Default is true
     * @return {string} the encrypted form
     */
    async encrypt(save = true){


        const normalized = Sanitizer.normalizeMSISDN(this.decrypted);

        this.encrypted = await Oracle.callEncryptMsisdn(normalized);

        if (save){
            //save to redis
            const key = 'decrypted_msisdn_'+this.decrypted;

            await redis.set_async(key, this.encrypted)

            redis.expire(key, ttl); // ttl of 1 month
        }

       return this.encrypted;
    }

}

module.exports = EncryptedMSISDN;
