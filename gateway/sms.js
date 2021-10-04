var smpp = require('smpp');
var request = require('request');
var http = require("http");

var rabbit = require('../lib/RabbitMQ');
var redis = require('../lib/redis_wrapper');
const config = require('../conf/config');

const serviceFinder = require('../conf/serviceLocator');
const logger = serviceFinder.get('logger');
const EncryptedMSISDN = require('../lib/encrypted_msisdn');

const sms_redis_key = config.configuration.sms;
        
        
(function(){

    var ConvertBase = function (num) {
        return {
            from : function (baseFrom) {
                return {
                    to : function (baseTo) {
                        return parseInt(num, baseFrom).toString(baseTo);
                    }
                };
            }
        };
    };
        
    // binary to decimal
    ConvertBase.bin2dec = function (num) {
        return ConvertBase(num).from(2).to(10);
    };
    
    // binary to hexadecimal
    ConvertBase.bin2hex = function (num) {
        return ConvertBase(num).from(2).to(16);
    };
    
    // decimal to binary
    ConvertBase.dec2bin = function (num) {
        return ConvertBase(num).from(10).to(2);
    };
    
    // decimal to hexadecimal
    ConvertBase.dec2hex = function (num) {
        return ConvertBase(num).from(10).to(16);
    };
    
    // hexadecimal to binary
    ConvertBase.hex2bin = function (num) {
        return ConvertBase(num).from(16).to(2);
    };
    
    // hexadecimal to decimal
    ConvertBase.hex2dec = function (num) {
        return ConvertBase(num).from(16).to(10);
    };
    
    this.ConvertBase = ConvertBase;
    
})(this);

var SmsGateway = {

    _error_message : "Connection to Service Gateway Failed!",

    session : null,

    connected: false,

    connection_time:null,

    start_time:null,

    enquire_time:null,

    ping_interval:null,

    state: 'disconnected',

    options : {
        host: '',
        port: '',
        username: '',
        password: '',
        allowed_shortcode: '',
        interval:5,
        keep_alive_minute:5,
        service_type:'CMT',
        gateway:'',
        operator:'',
        debug:false,
        alpha_tag:true,
        source_addr_ton: 0,
        source_addr_npi: 1,
        dest_addr_ton: 1,
        dest_addr_npi: 1,
        system_type: null,
        interface_version: null,
        bind_type: ''
    },

    init : function(options){

        SmsGateway.options = SmsGateway.extend({}, SmsGateway.options, options);

        if (SmsGateway.validate_options() === false){
            return false;
        }

        const sms_start_time = Date.now();
        SmsGateway.start_time = sms_start_time;

        redis.init();

        redis.save_to_set(sms_redis_key,"startTime",sms_start_time, function(err, reply){
        })
       
        SmsGateway.connect();

        SmsGateway.start_keep_alive();
    },

    validate_options : function(){

        for (x in SmsGateway.options){
            if (SmsGateway.options[x] === '' && ( 
            x != 'gateway' && 
            x != 'operator' &&
            x != 'bind_type' &&
            x != 'debug') ){
                logger.debug('Provide '+ x + ' parameter');
                return false;
            }
        }

        try {
            SmsGateway.options.keep_alive_minute = parseInt(SmsGateway.options.keep_alive_minute, 10);
        } catch (e) {
            SmsGateway.options.keep_alive_minute = 5;
        }

        SmsGateway.options.keep_alive_minute = Math.min(2, SmsGateway.options.keep_alive_minute);

        logger.debug('Username :', SmsGateway.options.username);
        logger.debug('Password :', SmsGateway.options.password);

        logger.debug('keep alive in minute :', SmsGateway.options.keep_alive_minute);
        logger.debug('enquiry interval in seconds :', SmsGateway.options.interval);
        logger.debug('allowed_shortcode :', SmsGateway.options.allowed_shortcode);
        logger.debug('operator :', SmsGateway.options.operator);
        logger.debug('request gateway :', SmsGateway.options.gateway);
        logger.debug('debug option :', SmsGateway.options.debug);
        return true;
    },

    start_keep_alive: function(){
        logger.debug('Keep alive started');

        setTimeout(function(){
            SmsGateway.connection_keep_alive();
        }, (1000 * 60 * SmsGateway.options.keep_alive_minute) ); 
    },
    connection_keep_alive: function(){

        logger.debug('Keep Alive Check');

        let timestampz = Date.now();
        let diff = ((timestampz - SmsGateway.enquire_time) / 1000);
        let max_wait = 1000*60*10;
        if( diff >= max_wait) {
            logger.debug('Connection reset, enquire_link update last sent', diff);
            SmsGateway.state = 'disconnected';
            SmsGateway.connect();
        }

        setTimeout(function(){
            SmsGateway.connection_keep_alive();
        }, (1000 * 60 * SmsGateway.options.keep_alive_minute));  
    },

    connect: function(){
        SmsGateway.connected = false;
        if(SmsGateway.ping_interval != null){
            clearTimeout(SmsGateway.ping_interval);
        }
        SmsGateway.bind();
        SmsGateway.persistent_connection();
    },

    bind: function(){
        
        if (SmsGateway.state != 'disconnected'){
            logger.debug('Bind is not disconnected');
            return 
        }
    
        SmsGateway.state = 'connecting';

        logger.debug('Intitiating connection');

        SmsGateway.session = smpp.connect('smpp://'+SmsGateway.options.host+':'+SmsGateway.options.port);

        bind_param = {
            system_id: SmsGateway.options.username,
            password: SmsGateway.options.password
        }

        if (SmsGateway.options.system_type != null){
            bind_param['system_type'] = SmsGateway.options.system_type
        }

        if (SmsGateway.options.interface_version != null){
            bind_param['interface_version'] = SmsGateway.options.interface_version
        }

        let status_bind_type = ""

        if (SmsGateway.options.bind_type == "receiver"){
            status_bind_type = "receiver"
            logger.debug(" -- SMS RECEIVER BIND --")
            SmsGateway.session.bind_receiver(bind_param, function(pdu) {
                SmsGateway.on_bind(pdu);
            });
        }else if (SmsGateway.options.bind_type == "transmitter"){
            status_bind_type = "transmitter"
            logger.debug(" -- SMS TRANSMITTER BIND --")
            SmsGateway.session.bind_transmitter(bind_param, function(pdu) {
                SmsGateway.on_bind(pdu);
            });
        }else{
            status_bind_type = "transceiver"
            logger.debug(" -- SMS TRANSCEIVER BIND --")
            SmsGateway.session.bind_transceiver(bind_param, function(pdu) {
                SmsGateway.on_bind(pdu);
            });
        }

        // Saving Status info - Begins
        redis.save_to_set(sms_redis_key,"bindType",status_bind_type, function(err, reply){
        })
        // Saving Status info - End
        
    },

    on_bind: function(pdu){
        if (pdu.command_status == 0) {
            // Successfully bound

            // Saving Status info - Begins
            const sms_bind_time = Date.now();
            redis.save_to_set(sms_redis_key,"bindUptime",sms_bind_time, function(err, reply){
            })
            // Saving Status info - End

            logger.debug('Successfully bound SMS');
            SmsGateway.connection_time = Date.now();
            SmsGateway.state = 'connected';
            SmsGateway.connected = true;
            SmsGateway.ping_connection();
            SmsGateway.incoming_request();
        }else{
            logger.debug(pdu)
            logger.debug('Bind was not Successfully');
        }
    },

    persistent_connection: function(){
        SmsGateway.session.on('close', function() {

            let timestampz = Date.now();
            let diff = timestampz - SmsGateway.connection_time;
            logger.debug('Close time duration in seconds', diff);

            if (SmsGateway.state == 'connected'){
                SmsGateway.state = 'disconnected';
            }
            setTimeout(function(){
                if (SmsGateway.state == 'disconnected'){
                    logger.debug('persistent connection started on close');
                    SmsGateway.connect();
                }
            }, 1000);    
        });

        SmsGateway.session.on('error', function(error) {

            logger.debug('Error message', error);

            let timestampz = Date.now();
            let diff = timestampz - SmsGateway.connection_time;
            logger.debug('Error time duration in seconds', diff);

            if (SmsGateway.state == 'connected'){
                SmsGateway.state = 'disconnected';
            }
            setTimeout(function(){
                if (SmsGateway.state == 'disconnected'){
                    logger.debug('persistent connection started on error');
                    SmsGateway.connect();
                }
            }, 1000);
        });
    },

    ping_connection: function (){
        SmsGateway.ping_interval = setTimeout(function(){
            try {
                SmsGateway.session.enquire_link({ }, function(pdu) {
                    logger.debug('enquire_link sent status:', pdu.command_status);   
                    SmsGateway.enquire_time = Date.now();
                });
                SmsGateway.ping_connection();
            } catch (e) {
                logger.error('could not set enquire_link', e);
            }
        }, parseInt(SmsGateway.options.interval * 1000, 10))
    },

    incoming_request: function(){

        if (SmsGateway.connected == false){
            logger.error('Gate way not connected');
            return false;
        }

        SmsGateway.session.on('submit_sm', function(pdu) {
            SmsGateway.session.send(pdu.response());

            if (pdu.esm_class == 4){
                return SmsGateway.incoming_dlr(pdu);
            }else{
                return SmsGateway.incoming_sms(pdu)
            }
        });

        SmsGateway.session.on('deliver_sm', function(pdu) {
            SmsGateway.session.send(pdu.response());

            if (pdu.esm_class == 4){
                return SmsGateway.incoming_dlr(pdu);
            }else{
                return SmsGateway.incoming_sms(pdu)
            }
        });

        SmsGateway.session.on('unbind', function(pdu) {
            logger.debug('unbind');
            SmsGateway.session.send(pdu.response());
            SmsGateway.session.close();
        });

        SmsGateway.session.on('data_sm', function(pdu) {
            logger.debug('data_sm');
            SmsGateway.session.send(pdu.response());
        });

        SmsGateway.session.on('enquire_link', function(pdu) {
            logger.debug('enquire_link gotten');
            SmsGateway.session.send(pdu.response());
        });
    },

    incoming_sms: function(pdu){
        // Saving Status info - Begins
        redis.increase_count(sms_redis_key, "received" ,function(err, redis_data){
        })
        // Saving Status info - End

        sms_data = SmsGateway.GetSmsData(pdu)

        msisdn = sms_data['msisdn'];
        short_code = sms_data['short_code'];
        operator = sms_data['operator'];
        sms_content = sms_data['sms_content'];

        // save to elastic search
        let timestampz = Date.now();

        body = {
            msisdn: msisdn,
            short_code: short_code,
            operator : operator,
            sms_content : sms_content,
            timestamp : timestampz,
            request_type:"Recieved SMS"
        }

        rabbit.publish( body , config.rabbit_mq.queues.request_log, function(qResp) {
            logger.debug("Rmq response", qResp)
            return call();
        });

        if (SmsGateway.options.debug == true){ 
            logger.debug('--------incoming sms-------');
            logger.debug(pdu);
            logger.debug(sms_data['sms_content']);
            logger.debug(msisdn);
            logger.debug('--------incoming sms-------');
        }

        return SmsGateway.trigger_event(pdu, sms_data);
    },

    incoming_dlr: function(pdu){

        // Saving Status info - Begins
        redis.increase_count(sms_redis_key, "dlrReceived" ,function(err, redis_data){
        })
        // Saving Status info - End

        logger.debug('deliver_sm gotten');

        sms_data = SmsGateway.GetSmsData(pdu)

        msisdn = sms_data['msisdn'];
        short_code = sms_data['short_code'];
        operator = sms_data['operator'];
        sms_content = sms_data['sms_content'];

        if (SmsGateway.options.debug == true){
            logger.debug('--------incoming dlr-------');
            logger.debug(pdu);
            logger.debug('processed message',sms_data['sms_content']);
            logger.debug('processed msisdn',msisdn);
            logger.debug('--------incoming dlr-------');
        }

        // save to elastic search
        let timestampz = Date.now();

        body = {
            msisdn: msisdn,
            short_code: short_code,
            operator : operator,
            sms_content : sms_content,
            timestamp : timestampz,
            request_type:"Recieved Dlr"
        }

        dlr_data = SmsGateway.GetDLRData(pdu)

        body = SmsGateway.extend({}, body, dlr_data);

        rabbit.publish( pdu , config.rabbit_mq.queues.dlr_pdu, function(qResp) {
            logger.debug("Rmq response", qResp)
            return call();
        });

        return rabbit.publish( body , config.rabbit_mq.queues.request_log, function(qResp) {
            logger.debug("Rmq response", qResp)
            return call();
        });

    },

    incoming_dlr_process: function(pdu){

        logger.debug("INSIDE DLR PROCESS");

        sms_data = SmsGateway.GetSmsData(pdu)

        msisdn = sms_data['msisdn'];
        short_code = sms_data['short_code'];
        operator = sms_data['operator'];
        sms_content = sms_data['sms_content'];

        let timestampz = Date.now();

        body = {
            msisdn: msisdn,
            short_code: short_code,
            operator : operator,
            sms_content : sms_content,
            timestamp : timestampz,
            request_type:"Recieved Dlr"
        }

        dlr_data = SmsGateway.GetDLRData(pdu)
        if (SmsGateway.options.debug == true){
            logger.debug("DLR_DATA ", dlr_data);
        }

        body = SmsGateway.extend({}, body, dlr_data);
        if (SmsGateway.options.debug == true){
            logger.debug('--------Processing dlr-------');
            logger.debug(pdu);
            logger.debug(body['id']);
            logger.debug('--------Processing dlr-------');
        }

        let incoming_msg_id = body['id'];

        // Ensure we are working with message_id as Hexadecimal
        if(Number(incoming_msg_id)){
            if (SmsGateway.options.debug == true){
                logger.debug("IS NOT HEX - Converting MessageId to Hexadecimal");
            }
            incoming_msg_id = Number(incoming_msg_id).toString(16);
        }        

        // REDIS GET DLR
        redis.get(incoming_msg_id, async function(err, dlr_url, reply){

            if(dlr_url){
                console.log('send dlr ')
                const dlr = dlr_url;

                dlr_data.msisdn =  await new EncryptedMSISDN(sms_data['msisdn'], false).getEncryptedMsisdn();

                request.get(dlr, {
                    qs: dlr_data
                }, (error, res, body) => {
                    if (error) {
                        logger.error(error)
                    }
                    if (SmsGateway.options.debug == true){
                        logger.debug(`status-Code: ${res.statusCode}`)
                        logger.debug(body)
                    }
                })
            }else{
                if (SmsGateway.options.debug == true){
                    logger.debug("NO Matching DLR for message_id in DB");
                }
            }
        })
    },

    mt_request_async: function(options){

        const alpha_tag = SmsGateway.options.alpha_tag;
        
        if(alpha_tag === false){

            allowed_shortcode = SmsGateway.options.allowed_shortcode.trim();
            
            if (allowed_shortcode.length == 0){
                return res.send({
                    'error' :true,
                    'message' :'Incomplete request',
                    'data' :['No Short code configured'],
                    'code' :400
                });
            }

            allowed_shortcode = allowed_shortcode.split(',');

            if (allowed_shortcode.length == 0){
                return res.send({
                    'error' :true,
                    'message' :'Incomplete request',
                    'data' :['No Short code configured'],
                    'code' :400
                });
            }

            find_short_code = allowed_shortcode.indexOf(short_code);

            if (find_short_code == '-1'){
                logger.debug('Incomplete request');
            }
            
        }

        msisdn = options.msisdn;
        operator = options.operator;
        short_code = options.short_code;
        message = options.message;
        dlr_url = options.dlr_url;
        dlr_mask = options.dlr_mask;

        if (SmsGateway.options.debug == true){
            logger.debug(dlr_url);
            logger.debug('options', options);
        }
       
        its_session_info = SmsGateway.get_session_info(false);

        SmsGateway.send_sms(msisdn, short_code, message, {
            "its_session_info": its_session_info
        }, true, function(err,data){
            logger.debug("SEND_SMS ERROR -",err);
            logger.debug("SEND_SMS DATA -",data);
        },dlr_url);    
        logger.debug('Message successfully received');
    },

    mt_request: function(options, mtres){
        msisdn = options.msisdn;
        operator = options.operator;
        short_code = options.short_code;
        message = options.message;

        rabbit.publish( options, config.rabbit_mq.queues.send_sms, function(qResp) {
            logger.debug("Rmq response", qResp)
            return call();
        });

         // send response message  
         return mtres.send({
            'error' :false,
            'message' :'Message successfully received',
            'code' :202,
            'data': ['Accepted for delivery']
        });
    },

    mt_direct_request: function(options, res){

        const alpha_tag = SmsGateway.options.alpha_tag;
        
        if(alpha_tag === false){
            
            allowed_shortcode = SmsGateway.options.allowed_shortcode.trim();
        
            if (allowed_shortcode.length == 0){
                return res.send({
                    'error' :true,
                    'message' :'Incomplete request',
                    'data' :['No Short code configured'],
                    'code' :400
                });
            }

            allowed_shortcode = allowed_shortcode.split(',');

            if (allowed_shortcode.length == 0){
                return res.send({
                    'error' :true,
                    'message' :'Incomplete request',
                    'data' :['No Short code configured'],
                    'code' :400
                });
            }

            find_short_code = allowed_shortcode.indexOf(short_code);

            if (find_short_code == '-1'){
                return res.send({
                    'error' :true,
                    'message' :'Incomplete request',
                    'data' :['Short code not allowed'],
                    'code' :400
                });
            }

        }
        
        msisdn = options.msisdn;
        operator = options.operator;
        short_code = options.short_code;
        message = options.message;

        logger.debug('options', options);
       
        its_session_info = SmsGateway.get_session_info(false);

        SmsGateway.send_sms(msisdn, short_code, message, {
            "its_session_info": its_session_info
        }, false,function(err,data){
            logger.debug("SEND_SMS ERROR -",err);
            logger.debug("SEND_SMS DATA -",data);
        });         
        
        return res.send({
            'error' :false,
            'message' :'Message successfully received',
            'code' :202,
            'data': ['Accepted for delivery']
        });
    },

    async trigger_event(pdu, sms_data){

        if(SmsGateway.options.gateway == ''){
            logger.debug('SMS Gate way not configured', qResp);
            return;
        }

        let timestampz = Date.now();

        short_code = sms_data['short_code'];

        // encrypt msisdn
        const encryptedMsisdn = await new EncryptedMSISDN(sms_data['msisdn'], false).getEncryptedMsisdn();
       
        request_url = SmsGateway.options.gateway 
        + "?msisdn=" + encryptedMsisdn
        + "&shortcode=" + short_code 
        + "&time=" + (timestampz/1000) 
        + "&message=" + encodeURIComponent(sms_data['sms_content'])
        + "&operator="+ SmsGateway.options.operator
       
        if (SmsGateway.options.debug == true){
            logger.debug('request_url', request_url)
        }

        request(request_url , function (error, response, body) {
            return SmsGateway.process_gate_way_response(sms_data, error, response, body);
        });
    },
    send_sms : function ( msisdn, shortcode, message , options, request_dlr, callback, dlr_url="None"){

        options =  !options ? {} : options;

        param = {
            service_type: SmsGateway.options.service_type,
            destination_addr: msisdn,
            source_addr: shortcode,
            source_addr_ton: SmsGateway.options.source_addr_ton,
            source_addr_npi: SmsGateway.options.source_addr_npi,
            dest_addr_ton: SmsGateway.options.dest_addr_ton,
            dest_addr_npi: SmsGateway.options.dest_addr_npi,
            short_message : message
        }

        if (request_dlr == true){
            param['registered_delivery'] = 3
        }

        var request_data = SmsGateway.extend({}, param, options);

        console.log(request_data)
    
        SmsGateway.session.submit_sm(request_data, function(pdu) {
            // Save to ELASTICSEARCH
            if (SmsGateway.options.debug == true){
                logger.debug("************** MESSAGE_ID===================", pdu.message_id);
                logger.debug("************** DLR URL===============", dlr_url);
                logger.debug(")))))))))))))))))))))))  PDU    ((((((((((((((((((((((((((", pdu);
            }

            const saveMessageJson = {
                'message_id': pdu.message_id,
                'dlr_url': dlr_url
            }

            if (dlr_url === "None"){
                if (SmsGateway.options.debug == true){
                    logger.debug("!!!!!!!!!!!!!!!!!!!!!!! DLR = NONE !!!!!!!!!!!!!!!!!!!!!!!!!!!");
                }
            }else{
                 
                let ms_id = pdu.message_id

                // Ensure we are working with message_id as Hexadecimal
                if(Number(ms_id)){
                    logger.debug("IS NOT HEX - Converting MessageId to Hexadecimal");
                    ms_id = Number(ms_id).toString(16);
                }
                
                redis.set(ms_id,dlr_url, function(err, reply){
                    if (SmsGateway.options.debug == true){
                        logger.debug("rdis set error", err);
                        logger.debug("redis set reply", reply);
                    }
                })
            }
            let timestampz = Date.now();

            if (pdu.command_status == 0) {
                // Saving Status info - Begins
                redis.increase_count(sms_redis_key, "sent" ,function(err, redis_data){
                })
                // Saving Status info - End
                if (SmsGateway.options.debug == true){ 
                    body =  {
                        timestamp:timestampz,
                        msisdn:msisdn,
                        operator:operator,
                        short_code:short_code,
                        message:message,
                        request_type:"Sent SMS",
                        command_status: pdu.command_status
                    }
            
                    rabbit.publish( body, config.rabbit_mq.queues.request_log, function(qResp) {
                        logger.debug("Rmq response", qResp)
                        return call();
                    });

                    if (SmsGateway.options.debug == true){
                        logger.debug("Send message id", pdu.message_id);
                    }
                }

                if (callback != undefined){
                    return callback(true, pdu.message_id);
                }
            }else{
                // Saving Status info - Begins
                redis.increase_count(sms_redis_key, "failed" ,function(err, redis_data){
                })
                // Saving Status info - End
                body =  {
                    timestamp:timestampz,
                    msisdn:msisdn,
                    operator:operator,
                    short_code:short_code,
                    message:message,
                    request_type:"Failed SMS",
                    command_status: pdu.command_status
                }
        
                rabbit.publish( body, config.rabbit_mq.queues.request_log, function(qResp) {
                    logger.debug("Rmq response", qResp)
                    return call();
                });

                return callback(false);
            }
        });
    },

    get_session_info : function (continue_session , session_number){

        its_session_info = new Buffer(2);
    
        if (!session_number){
            session_number = Math.floor(Math.random() * 255) + 0;
        }
        its_session_info.writeUInt8(session_number);
    
        continue_session = (continue_session == true) ? true : false;
        seqence_number = ((Math.floor(Math.random() * 50) + 0) * 2);
        if(continue_session == true){
            seqence_number += 1
        }
        its_session_info.writeUInt8(seqence_number,1);
        return its_session_info;
    },

    process_session_info : function(its_session_info){
        session_number = its_session_info[0];
        sequence_number = its_session_info[1];
        sequence_number_bin = ConvertBase.hex2bin(sequence_number);
        last_bit = sequence_number_bin.slice(-1);
        status = (last_bit == '0') ? 'inactive' : 'active';
        if (SmsGateway.options.debug == true){
            logger.debug(its_session_info);
            logger.debug('sequence_number binnary', sequence_number_bin );
            logger.debug('last_bit', last_bit );
            logger.debug('session_number',session_number);
            logger.debug('sequence_number',sequence_number);
        }
        return {status:status,session_number:session_number};
    },

    GetSmsData: function (pdu){
        msisdn = pdu.source_addr;
        short_code = pdu.destination_addr;
        chunk = pdu.short_message['message'];
        sms_content = chunk.toString('utf8');
       
        return {
            sms_content:sms_content,
            msisdn:msisdn,
            short_code:short_code,
            operator:SmsGateway.options.operator
        };
    },

    GetDLRData: function (pdu){
        msisdn = pdu.source_addr;
        short_code = pdu.destination_addr;
        chunk = pdu.short_message['message'];
        dlr_content = chunk.toString('utf8');

        sms_content = sms_content.replace("submit date", "submit_date")
        sms_content = sms_content.replace("done date", "done_date")
        dlr_array = sms_content.split(' ');

        dlr_values = {}
        for (item in dlr_array){
            sub_item = dlr_array[item].split(':');
            dlr_values[sub_item[0]] = sub_item[1]
        }
        dlr_data = SmsGateway.extend({}, {
            sms_content:sms_content,
            msisdn:msisdn,
            short_code:short_code,
            operator:SmsGateway.options.operator
        }, dlr_values);
        
        if (dlr_data['err'] == '000'){
            dlr_data['state'] = 8
        }else{
            dlr_data['state'] = 16
        }
        return dlr_data;
    },

    extend : function (target) {
        var sources = [].slice.call(arguments, 1);
        sources.forEach(function (source) {
            for (var prop in source) {
                target[prop] = source[prop];
            }
        });
        return target;
    },

    process_gate_way_response:function(sms_data,  error, response, body ){
       
        msisdn = sms_data['msisdn'];

        if (SmsGateway.options.debug == true){
            logger.debug('error:', error); 
            logger.debug('statusCode:', response.statusCode); 
            logger.debug('statusCode:', body); 
        }

        let timestampz = Date.now();

        response_data =  {
            timestamp:timestampz,
            msisdn:sms_data['msisdn'],
            operator:SmsGateway.options.operator,
            short_code:sms_data["short_code"],
            request_type:"Response SMS",
            body:body
        }

        rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
            if (SmsGateway.options.debug == true){ 
                logger.debug("Rmq response", qResp)
            }
            return call();
        });
    }
}

module.exports = SmsGateway;