const mysql      = require('mysql');
const config  = require('../conf/config');

let connection;
class MySql {
    static init(){
        connection = mysql.createConnection({
            host     : config.mysql.host,
            user     : config.mysql.user,
            password : config.mysql.password,
            database : config.mysql.database,
            port : config.mysql.port,
            multipleStatements: true
        });

        connection.connect();

        return connection;
    }

    static async query(query){
        return new Promise((resolve, reject) => {
            connection.query(query, function (error, results, fields) {
                if (error) {
                    reject(error);
                    console.error(error)
                }
                else resolve(results[0].solution)
                console.log('The solution is: ', results[0].solution);
            });
        })
    }

    static async callProcedure(name, params){

        const query_str = `CALL ${name}(?,@output); select @output`;
        return new Promise((resolve, reject) => {
            connection.query(query_str, params, function(err,rows){
                if (err) {
                    reject(error);
                    console.error(error)
                }

                resolve(rows[1][0]['@output']);
            });
        })

    }
}

module.exports = MySql
