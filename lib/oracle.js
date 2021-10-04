const oracledb      = require('oracledb');
const config  = require('../conf/config');
const serviceFinder = require('../conf/di');

const logger = serviceFinder.get('logger');

let connection;
class Oracle {
    static init(){

        // oracledb.createPool({
        //     user: config.oracle.user,
        //     password: config.oracle.password,
        //     connectString: '',
        //     poolMin: 10,
        //     poolMax: 10,
        //     poolIncrement: 0
        // })

        return new Promise((resolve, reject) => {
            oracledb.getConnection(
                {
                    user          : config.oracle.user,
                    password      : config.oracle.password,
                    connectString : config.oracle.connectionString,
                },
                function(err, _connection) {
                    if (err) {
                        console.error(err.message);
                        reject(err);
                        return;
                    }
                    connection = _connection;
                    console.log('connected to oracle')
                    resolve(connection);
                });
        })
       

    }


    static async callEncryptMsisdn(msisdn){
        return new Promise((resolve, reject) => {
            const start  = new Date();
            connection.execute(
                `BEGIN prc_subs_mobile_msisdn(:v_msisdn, :v_encrypted_msisdn); END;`,
                {  // bind variables
                    v_msisdn:   msisdn,
                    v_encrypted_msisdn: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
                },
                function (err, result) {
                    if (err) {
                         console.error(err.message); reject(err);
                    } else {
                        // console.log(result.outBinds);
                        const end = new Date();
                        logger.debug('oracle took '+ (end.getTime() - start.getTime())/1000 + " seconds to decrypt ", msisdn);
                        resolve(result.outBinds.v_encrypted_msisdn)
                    }
                    
                });
        });
    }

    static async callDecrpytMsisdn(msisdn){
        console.log('to decrypt ', msisdn)
        return new Promise((resolve, reject) => {
            const start  = new Date();

            connection.execute(
                `BEGIN prc_subs_mobile_encrypted(:v_encrypted_msisdn, :v_msisdn); END;`,
                {  // bind variables
                    v_encrypted_msisdn:   msisdn,
                    v_msisdn: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
                },
                function (err, result) {
                    if (err) { 
                        console.error(err.message);
                          reject(err);
                    } else {
                        const end = new Date();
                        // console.log(result.outBinds);
                        logger.debug('oracle took '+ (end.getTime() - start.getTime())/1000 + " seconds to decrypt ", msisdn);
                        resolve(result.outBinds.v_msisdn)
                    }
                    
                });

        })



        }

}
module.exports = Oracle;


