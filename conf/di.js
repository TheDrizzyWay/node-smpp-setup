
const elasticSearch = require('elasticsearch');
const serviceFinder = require('./serviceLocator');
const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('./config');
const Logger = require('./logger');
var request = require('request');
const rabbit = require('amqplib');

const {format, transports } = require('winston');
const { combine, timestamp } = format;


serviceFinder.register('logger', (serviceLocator) => {

    const logFormat = format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.align(),
        winston.format.printf((info) => {
          const {
            timestamp, level, message, ...args
          } = info;
    
          const ts = timestamp.slice(0, 19).replace('T', ' ');
          return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
        }),
      );

    const transport = new (transports.DailyRotateFile)({
        filename: '%DATE%.log',
        datePattern: 'YYYY-MM',
        zippedArchive: true,
        json: false,
        level: 'info',
        format: combine(
            timestamp(),
            logFormat
          ),
        dirname: config.logging.path,
      });


      
    
      const winstonLogger = winston.createLogger({
        transports: [
          transport,
          new winston.transports.Console({ level: 'debug',
           format: combine(
            timestamp(),
            logFormat
          ), 
        })
        ]
      });

      return new Logger(winstonLogger);

      
});

serviceFinder.register('elasticSearch', (serviceLocator) => {
    index_name = config.database.elasticSearch.documents.smppLogs.index; 
    index_type = config.database.elasticSearch.documents.smppLogs.type; 
    const elasticSearchClient = new elasticSearch.Client({
        host: `${config.database.elasticSearch.connection.host}:${config.database.elasticSearch.connection.port}`,
        apiVersion: config.database.elasticSearch.apiVersion,
        log: config.database.elasticSearch.loggingLevel
    });

    const logger = serviceLocator.get('logger');

    // check if index exists
    return elasticSearchClient.search({
        index: index_name
    }).then(function(value) {
        return elasticSearchClient;
    }).catch((err)=>
    {
        
        if(err.status === 404)
        {
            // create index 
            return elasticSearchClient.indices.create(
            {
                index: index_name,
                mapping: {}
            }, function (err, resp, respcode) {
                // update mapping
            body_data = {
                "properties":{  
                    "timestamp":{  
                        "type":"long"
                        },
                        "ussd_content":{  
                            "type":"string"
                        },
                        "operator":{  
                            "type":"string"
                        },
                        "event":{  
                            "type":"string"
                        },
                        "short_code":{  
                            "type":"string"
                        },
                        "msisdn":{  
                            "type":"string"
                        },
                        "gateway":{
                            "type":"string"
                        },
                        "request_type" : {
                            "type":"string",
                            "index":"not_analyzed"
                        }
                    }
                }
        
                let ussdPromise = new Promise(
                    function (resolve, reject) {
                        incoming_url = `http://${config.database.elasticSearch.connection.host}:${config.database.elasticSearch.connection.port}/${index_name}/_mapping/${index_type}`
                        request({ url: incoming_url, method: 'PUT', json: body_data},
                            function(error, request, body){
                            if(error){
                                var reason = new Error('Unable to map incoming');
                                reject(reason); // reject
                            }else{
                                resolve("DONE"); // fulfilled
                            }
                        });
                    }
                ); 
                return Promise.all([ussdPromise]).then(function(values) {
                    return elasticSearchClient;
                })
                .catch(error=>{
                    logger.error('error', error);
                })
            });
        }
    });
});
/**
 * Returns a RabbitMQ connection instance.
 */
serviceFinder.register('rabbitmq', (servicelocator) => {
    const logger = servicelocator.get('logger');
    const connectionString = `amqp://${config.rabbit_mq.user}:${config.rabbit_mq.pass}@${config.rabbit_mq.host}:${config.rabbit_mq.port}`;
  
    return rabbit.connect(connectionString, (err, connection) => new Promise((resolve, reject) => {
      // If the connection throws an error
        if (err) {
            logger.error(`RabbitMQ connection error: ${err}`);
            return reject(err);
        }
  
        connection.on('error', (connectionError) => {
            logger.error(`RabbitMQ connection error: ${connectionError}`);
            process.exit(1);
        });
  
        connection.on('blocked', (reason) => {
            logger.error(`RabbitMQ connection blocked: ${reason}`);
            process.exit(1);
        });
  
        // If the Node process ends, close the RabbitMQ connection
        process.on('SIGINT', () => {
            connection.close();
            process.exit(0);
        });
        return resolve(connection);
    }));
});
  
module.exports = serviceFinder;
