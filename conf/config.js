var config = {
    debug_enabled: process.env.DEBUG_ENABLED,
    ussd: {
        host: process.env.USSD_HOST,
        port: process.env.USSD_PORT,
        username: process.env.USSD_USERNAME,
        password: process.env.USSD_PASSWORD,
        shortcode: process.env.SHORTCODE,
        gateway: process.env.USSD_GATE_WAY,
        operator: process.env.USSD_OPERATOR,
        interval:process.env.PING_INTERVAL,
        character_length:process.env.USSD_CHARACTER_LENGTH,
        keep_alive_minute:process.env.USSD_KEEP_ALIVE_MINUTE,
        activate:process.env.USSD_ACTIVATE,
        source_addr_ton: process.env.USSD_SOURCE_ADDR_TON,
        source_addr_npi: process.env.USSD_SOURCE_ADDR_NPI,
        dest_addr_ton: process.env.USSD_DEST_ADDR_TON,
        dest_addr_npi: process.env.USSD_DEST_ADDR_NPI,
        system_type: process.env.USSD_SYSTEM_TYPE,
        interface_version: process.env.USSD_INTERFACE_VERSION,
        bind_type: process.env.USSD_BIND_TYPE
    },
    sms: {
        host: process.env.SMS_HOST,
        port: process.env.SMS_PORT,
        username: process.env.SMS_USERNAME,
        password: process.env.SMS_PASSWORD,
        shortcode: process.env.SHORTCODE,
        gateway: process.env.SMS_GATE_WAY,
        operator: process.env.SMS_OPERATOR,
        interval:process.env.PING_INTERVAL,
        character_length:process.env.SMS_CHARACTER_LENGTH,
        keep_alive_minute:process.env.SMS_KEEP_ALIVE_MINUTE,
        service_type:process.env.SMS_SYSTEM_TYPE,
        activate:process.env.SMS_ACTIVATE,
        source_addr_ton: process.env.SMS_SOURCE_ADDR_TON,
        source_addr_npi: process.env.SMS_SOURCE_ADDR_NPI,
        dest_addr_ton: process.env.SMS_DEST_ADDR_TON,
        dest_addr_npi: process.env.SMS_DEST_ADDR_NPI,
        system_type: process.env.SMS_SYSTEM_TYPE,
        interface_version: process.env.SMS_INTERFACE_VERSION,
        bind_type: process.env.SMS_BIND_TYPE
    },
    rabbit_mq: {
      host: process.env.RABBITMQ_HOST,
      port: process.env.RABBITMQ_PORT,
      user: process.env.RABBITMQ_USERNAME,
      pass: process.env.RABBITMQ_PASSWORD,
      queues: {
            request_log: 'smpp_' + process.env.SMPP_PREFIX + "_request_logs",
            send_sms: 'smpp_' + process.env.SMPP_PREFIX + "_send_sms",
            dlr_pdu: 'smpp_' + process.env.SMPP_PREFIX + "_dlr_pdu",
        },
    },
    database:{
        redis:{
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD,
            db: process.env.REDIS_DB
        },
        elasticSearch:{
            connection:{
                host:process.env.SMPP_LOGS_ELASTICSEARCH_HOST,
                port:process.env.SMPP_LOGS_ELASTICSEARCH_PORT
            },
            documents:{
                smppLogs:{
                    index: 'smpp_' + process.env.SMPP_PREFIX + "_data",
                    type:'request_logs'
                },
                dlr:{
                    index: 'smpp_' + process.env.SMPP_PREFIX + "_data",
                    type:'dlr_message_id'
                }
            },
            apiVersion:'6.3',
            loggingLevel:''
        }
    },
    mysql: {
        host     : process.env.MY_SQL_HOST,
        user     : process.env.MY_SQL_USERNAME,
        password : process.env.MY_SQL_PASSWORD,
        database : process.env.MY_SQL_DATABASE,
        port : process.env.MY_SQL_PORT,
    },
    oracle: {
        host     : process.env.ORACLE_HOST,
        user     : process.env.ORACLE_USERNAME,
        password : process.env.ORACLE_PASSWORD,
        sid : process.env.ORACLE_SID,
        port : process.env.ORACLE_PORT,
        connectionString : process.env.ORACLE_CONNECTION_STRING
    },
    blue_chip:{
        baseUrl: process.env.BLUE_CHIP_URL
    },
    app_port:process.env.APP_PORT,
    smpp_prefix:process.env.SMPP_PREFIX,
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      console: process.env.LOG_ENABLE_CONSOLE === 'true',
      type: process.env.LOG_TYPE,
      path: process.env.LOG_PATH
    },
    alpha_tag: process.env.ALPHA_TAG || 'true',
    configuration:{
        ussd: 'config_' + process.env.SMPP_PREFIX + '_ussd',
        sms: 'config_' + process.env.SMPP_PREFIX + '_sms',
        general: 'config_' + process.env.SMPP_PREFIX + '_general'
    }
};

module.exports = config;
