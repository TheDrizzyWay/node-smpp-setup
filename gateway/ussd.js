var smpp = require('smpp');
var request = require('request');

var redis = require('../lib/redis_wrapper');
var rabbit = require('../lib/RabbitMQ');
const config = require('../conf/config');
const serviceFinder = require('../conf/di');

const logger = serviceFinder.get('logger');

const ussd_redis_key = config.configuration.ussd;

const EncryptedMSISDN = require('../lib/encrypted_msisdn');

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

var UssdGateway = {

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
        character_length:182,
        keep_alive_minute:5,
        gateway:'',
        operator:'',
        debug:false,
        source_addr_ton: 0,
        source_addr_npi: 0,
        dest_addr_ton: 1,
        dest_addr_npi: 1,
        system_type:null,
        interface_version:null,
        bind_type: ''
    },

    init : function(options){

        UssdGateway.options = UssdGateway.extend({}, UssdGateway.options, options);

        if (UssdGateway.validate_options() === false){
            return false;
        }

        const ussd_start_time = Date.now();
        UssdGateway.start_time = ussd_start_time;
        
        redis.init();

        redis.save_to_set(ussd_redis_key,"startTime",ussd_start_time, function(err, reply){
        })

        UssdGateway.connect();
     
        redis.init();

        UssdGateway.start_keep_alive();  
    },

    validate_options : function(){

        for (x in UssdGateway.options){
            if (UssdGateway.options[x] === '' && ( 
            x != 'gateway' && 
            x != 'operator' &&
            x != 'bind_type' &&
            x != 'debug') ){
                logger.debug('Provide '+ x + ' parameter');
                return false;
            }
        }

        try {
            UssdGateway.options.character_length = parseInt(UssdGateway.options.character_length, 10);
        } catch (e) {
            UssdGateway.options.character_length = 182;
        }
        UssdGateway.options.character_length = Math.min(182, UssdGateway.options.character_length);

        try {
            UssdGateway.options.keep_alive_minute = parseInt(UssdGateway.options.keep_alive_minute, 10);
        } catch (e) {
            UssdGateway.options.keep_alive_minute = 5;
        }

        UssdGateway.options.keep_alive_minute = Math.min(2, UssdGateway.options.keep_alive_minute);

        logger.debug('Username :', UssdGateway.options.username);
        logger.debug('Password :', UssdGateway.options.password);

        logger.debug('keep alive in minute :', UssdGateway.options.keep_alive_minute);
        logger.debug('enquiry interval in seconds :', UssdGateway.options.interval);
        logger.debug('Ussd character length :', UssdGateway.options.character_length);
        logger.debug('allowed_shortcode :', UssdGateway.options.allowed_shortcode);
        logger.debug('operator :', UssdGateway.options.operator);
        logger.debug('request gateway :', UssdGateway.options.gateway);
        logger.debug('debug option :', UssdGateway.options.debug);

        return true;
    },

    start_keep_alive: function(){
        logger.debug('Keep alive started');
  
        setTimeout(function(){
            UssdGateway.connection_keep_alive();
        }, (1000 * 60 * UssdGateway.options.keep_alive_minute) ); 
    },
    connection_keep_alive: function(){

        logger.debug('Keep Alive Check');

        let timestampz = Date.now();
        let diff = ((timestampz - UssdGateway.enquire_time) / 1000);
        let max_wait = 1000*60*10;
        if( diff >= max_wait) {
            logger.debug('Connection reset, enquire_link update last sent', diff);
            UssdGateway.state = 'disconnected';
            UssdGateway.connect();
        }

        setTimeout(function(){
            UssdGateway.connection_keep_alive();
        }, (1000 * 60 * UssdGateway.options.keep_alive_minute));  
    },

    connect: function(){
        UssdGateway.connected = false;
        if(UssdGateway.ping_interval != null){
            clearTimeout(UssdGateway.ping_interval);
        }
        UssdGateway.bind();
        UssdGateway.persistent_connection();
    },

    bind: function(){
        
        if (UssdGateway.state != 'disconnected'){
            logger.debug('Bind is not disconnected');
            return 
        }
    
        UssdGateway.state = 'connecting';

        logger.debug('Intitiating connection');

        UssdGateway.session = smpp.connect('smpp://'+UssdGateway.options.host+':'+UssdGateway.options.port);

        bind_param = {
            system_id: UssdGateway.options.username,
            password: UssdGateway.options.password
        }

        if (UssdGateway.options.system_type != null){
            bind_param['system_type'] = UssdGateway.options.system_type
        }

        if (UssdGateway.options.interface_version != null){
            bind_param['interface_version'] = UssdGateway.options.interface_version
        }

        let status_bind_type = ""

        if (UssdGateway.options.bind_type == "receiver"){
            status_bind_type = "receiver"
            logger.debug(" -- USSD RECEIVER BIND --")
            UssdGateway.session.bind_receiver(bind_param, function(pdu) {
                UssdGateway.on_bind(pdu);
            });
        }else if (UssdGateway.options.bind_type == "transmitter"){
            status_bind_type = "transmitter"
            logger.debug(" -- USSD TRANSMITTER BIND --")
            UssdGateway.session.bind_transmitter(bind_param, function(pdu) {
                UssdGateway.on_bind(pdu);
            });
        }else{
            status_bind_type = "transceiver"
            logger.debug(" -- USSD TRANSCEIVER BIND --")
            logger.debug(bind_param)
            UssdGateway.session.bind_transceiver(bind_param, function(pdu) {
                console.log('binded.......')
                UssdGateway.on_bind(pdu);
            });
        }

        // Saving Status info - Begins
        redis.save_to_set(ussd_redis_key,"bindType",status_bind_type, function(err, reply){
        })
        // Saving Status info - End
    },

    on_bind: function(pdu){
        if (pdu.command_status == 0) {
            // Successfully bound

            // Saving Status info - Begins
            const ussd_bind_time = Date.now();
            redis.save_to_set(ussd_redis_key,"bindUptime",ussd_bind_time, function(err, reply){
            })
            // Saving Status info - End

            logger.debug('Successfully bound USSD');
            UssdGateway.connection_time = Date.now();
            UssdGateway.state = 'connected';
            UssdGateway.connected = true;
            UssdGateway.ping_connection();
            UssdGateway.incoming_request();
        }else{
            logger.debug(pdu)
            logger.debug('Bind was not Successfully');
        }
    },

    persistent_connection: function(){
        UssdGateway.session.on('close', function() {

            let timestampz = Date.now();
            let diff = timestampz - UssdGateway.connection_time;
            logger.debug('Close time duration in seconds', diff);

            if (UssdGateway.state == 'connected'){
                UssdGateway.state = 'disconnected';
            }
            setTimeout(function(){
                if (UssdGateway.state == 'disconnected'){
                    logger.debug('persistent connection started on close');
                    UssdGateway.connect();
                }
            }, 1000);    
        });

        UssdGateway.session.on('error', function(error) {

            logger.debug('Error message', error);

            let timestampz = Date.now();
            let diff = timestampz - UssdGateway.connection_time;
            logger.debug('Error time duration in seconds', diff);

            if (UssdGateway.state == 'connected'){
                UssdGateway.state = 'disconnected';
            }
            setTimeout(function(){
                if (UssdGateway.state == 'disconnected'){
                    logger.debug('persistent connection started on error');
                    UssdGateway.connect();
                }
            }, 1000);
        });
    },

    ping_connection: function (){
        UssdGateway.ping_interval = setTimeout(function(){
            try {
                UssdGateway.session.enquire_link({ }, function(pdu) {
                    logger.debug('enquire_link sent status:', pdu.command_status);   
                    UssdGateway.enquire_time = Date.now();
                });
                UssdGateway.ping_connection();
            } catch (e) {
                logger.debug('could not set enquire_link', e);
            }
        }, parseInt(UssdGateway.options.interval * 1000, 10))
    },

    incoming_request: function(){

        if (UssdGateway.connected == false){
            logger.debug('Gate way not connected');
            return false;
        }

        UssdGateway.session.on('deliver_sm', function(pdu) {

            if (pdu.esm_class == 4){
                logger.debug('dlr delivery track');
            }

            UssdGateway.session.send(pdu.response({
                command_status:0x0000
            }));

            ussd_data = UssdGateway.GetUssdData(pdu)

            // logger.debug("USSD_DATA -----", ussd_data);

            event = ussd_data['event'];
            msisdn = ussd_data['msisdn'];
            short_code = ussd_data['short_code'];
            operator = ussd_data['operator'];
            ussd_content = ussd_data['ussd_content'];
            let timestampz = Date.now();
            

            // save to elastic search
            body = {
                event: event,
                msisdn: msisdn,
                short_code: short_code,
                operator : operator,
                ussd_content : ussd_content,
                timestamp : timestampz,
                request_type:"Recieved USSD",
                gate_way:"USSD"
            }

            rabbit.publish( body , config.rabbit_mq.queues.request_log, function(qResp) {
                logger.debug("Rmq response", qResp)
                return call();
            });

            mt_track_key = UssdGateway.mt_key(msisdn, operator, short_code);

            if (UssdGateway.options.debug == true){ 
                logger.debug(event);
                logger.debug('deliver_sm');
                logger.debug(pdu);
                logger.debug(ussd_data['ussd_content']);
                logger.debug(msisdn);
            }

            redis.get_data(mt_track_key ,function(err, redis_data){
                if (redis_data != null){
                    logger.debug("--------ussd-mt---------");
                    ussd_data['event'] = 'start';
                    UssdGateway.trigger_event(msisdn, 'start', pdu, ussd_data, redis_data['app_id']);
                }else{
                    UssdGateway.trigger_event(msisdn, event, pdu, ussd_data);
                }
            });
                       
            // UssdGateway.trigger_event(msisdn, event, pdu, ussd_data);
        });

        UssdGateway.session.on('unbind', function(pdu) {
            logger.debug('unbind');
            UssdGateway.session.send(pdu.response());
            UssdGateway.session.close();
        });

        UssdGateway.session.on('data_sm', function(pdu) {
            logger.debug('data_sm');
            UssdGateway.session.send(pdu.response());
        });

        UssdGateway.session.on('enquire_link', function(pdu) {
            logger.debug('enquire_link gotten');
            UssdGateway.session.send(pdu.response());
        });

        UssdGateway.session.on('submit_sm', function(pdu) {
            logger.debug('submit_sm gotten');
        });
    },

    mt_key: function(msisdn, operator, short_code){
        return "ussd-mt:"+msisdn+'-'+operator+'-'+short_code;
    },

    mt_request: function(options, res){

        allowed_shortcode = UssdGateway.options.allowed_shortcode.trim();
        
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

        msisdn = options.msisdn;
        operator = options.operator;
        short_code = options.short_code;
        message = options.message;
        app_id = options.app_id;

        find_short_code = allowed_shortcode.indexOf(short_code);

        if (find_short_code == '-1'){
            return res.send({
                'error' :true,
                'message' :'Incomplete request',
                'data' :['Short code not allowed'],
                'code' :400
            });
        }
        
        logger.debug('options', options);
       
        its_session_info = UssdGateway.get_session_info(false);

        track_key = UssdGateway.mt_key(msisdn, operator, short_code);

        redis.save_data(track_key, {
            msisdn:msisdn,
            operator:operator,
            short_code:short_code,
            message:message,
            app_id:app_id,
        },function(err, reply){

            redis.expire(track_key, 120); // ttl of two min

            return UssdGateway.send_ussd(msisdn, short_code, message, {
                "ussd_service_op": 17,
                "its_session_info": its_session_info
            });
        })
        
        // save to elastic search
        let timestampz = Date.now();
        
        body =  {
            timestamp:timestampz,
            msisdn:msisdn,
            operator:operator,
            short_code:short_code,
            message:message,
            app_id:app_id,
            request_type:"Sent USSD",
            gate_way:"USSD"
        }

        rabbit.publish( body, config.rabbit_mq.queues.request_log, function(qResp) {
            logger.debug("Rmq response", qResp)
            return call();
        });
        
        // send response message  
        return res.send({
            'error' :false,
            'message' :'Message successfully received',
            'code' :202,
            'data': ['Accepted for delivery']
        });
    },

    trigger_event(msisdn, event, pdu, ussd_data, app_id){
        switch(event){

            case "start":
                return UssdGateway._OnBeginEvent(pdu , ussd_data, app_id);
            break;

            case "continue":
                return UssdGateway._OnContinueEvent(pdu , ussd_data);
            break;

            default :
                return UssdGateway.send_ussd(msisdn , ussd_data['shortcode'], "cannot identify this event");
            break;
        }
    },
    send_ussd : function ( msisdn, shortcode, message , options){

        options =  !options ? {} : options;

        param = {
            service_type: 'USSD',
            destination_addr: msisdn,
            source_addr: shortcode,
            source_addr_ton: UssdGateway.options.source_addr_ton,
            source_addr_npi: UssdGateway.options.source_addr_npi,
            dest_addr_ton: UssdGateway.options.dest_addr_ton,
            dest_addr_npi: UssdGateway.options.dest_addr_npi,
            registered_delivery: 3,
            short_message : message
        }
    
        param['ussd_service_op'] = 17;

        var request_data = UssdGateway.extend({}, param, options);
    
        UssdGateway.session.submit_sm(request_data, function(pdu) {
            if (pdu.command_status == 0) {
                // Saving Status info - Begins
                redis.increase_count(ussd_redis_key, "sent" ,function(err, redis_data){
                })
                if (UssdGateway.options.debug == true){ 
                    logger.debug("Send message id",pdu.message_id);
                }
            }else{
                // Saving Status info - Begins
                redis.increase_count(ussd_redis_key, "failed" ,function(err, redis_data){
                })
                // Saving Status info - End
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
        if (UssdGateway.options.debug == true){
            logger.debug(its_session_info);
            logger.debug('sequence_number binnary', sequence_number_bin );
            logger.debug('last_bit', last_bit );
            logger.debug('session_number',session_number);
            logger.debug('sequence_number',sequence_number);
        }
        return {status:status,session_number:session_number};
    },

    GetUssdData: function (pdu){
        // Saving Status info - Begins
        redis.increase_count(ussd_redis_key, "received" ,function(err, redis_data){
        })
        // Saving Status info - End

        msisdn = pdu.source_addr;
        short_code = pdu.destination_addr;
        chunk = pdu.short_message['message'];
        ussd_content = chunk.toString('utf8');
        event = 'start';
        if ( ussd_content.indexOf("*"+short_code) == -1){
            event = 'continue';
        }
        return {
            event:event,
            ussd_content:ussd_content,
            msisdn:msisdn,
            short_code:short_code,
            operator:UssdGateway.options.operator
        };
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

    GetUssdParams: function (ussd_content){
        ussd_string = ussd_content.substring(1, ussd_content.length-1);
    
        var short_code = '', app_code = '', ussd_option = '';
        ussd_param = ussd_string.split('*');
    
        if (ussd_param.length > 0){
            short_code = ussd_param[0];
            ussd_param.shift();
           
            if (ussd_param.length > 0){
                app_code = ussd_param[0];
                ussd_param.shift();
            }
            ussd_option = ussd_param.join("*");
        }
    
        return {
            short_code:short_code,
            app_code:app_code,
            ussd_option:ussd_option
        };
    },

    _OnBeginEvent : async function (pdu , ussd_data, app_id){

        if(UssdGateway.options.gateway == ''){
            return UssdGateway.send_ussd(ussd_data['msisdn'], ussd_data["short_code"] , 'Ussd Gate way not configured');
        }

        if (app_id == undefined){
            Options = UssdGateway.GetUssdParams(ussd_data['ussd_content']);
            short_code = ussd_data['short_code'];
            app_code = Options["app_code"];
            ussd_option = Options["ussd_option"];
            ussd_service_op = 17; 
        }else{
            short_code = ussd_data["short_code"];
            app_code = '';
            ussd_option = '';
            ussd_service_op = 3; 
            redis.delete(UssdGateway.mt_key(ussd_data['msisdn'], ussd_data['operator'], short_code));
        }

        // encrypt msisdn



        const encryptedMsisdn = await new EncryptedMSISDN(ussd_data['msisdn'], false).getEncryptedMsisdn();
        
       
        request_url = UssdGateway.options.gateway 
        + "?msisdn=" + encryptedMsisdn
        + "&short_code=" + short_code 
        + "&app_code=" + app_code 
        + "&ussd_option=" + ussd_option 
        + "&event=start"
        + "&message=" + encodeURIComponent(ussd_data['ussd_content'])
        + "&operator="+ UssdGateway.options.operator
        if (app_id != undefined){
            request_url = request_url + "&app_id="+app_id
        }

        if (UssdGateway.options.debug == true){
            logger.debug('request_url', request_url)
        }

        request(request_url , function (error, response, body) {
            return UssdGateway.process_gate_way_response(pdu , ussd_data, error, response, body, ussd_service_op);
        });
    },

    _OnContinueEvent : async function (pdu , ussd_data){

        if(UssdGateway.options.gateway == ''){
            return UssdGateway.send_ussd(ussd_data['msisdn'], ussd_data["short_code"] , 'Ussd Gate way not configured');
        }

        // encrypt msisdn
        const encryptedMsisdn = await new EncryptedMSISDN(ussd_data['msisdn'], false).getEncryptedMsisdn();
       
        request_url = UssdGateway.options.gateway 
        + "?msisdn=" + encryptedMsisdn
        + "&message=" + ussd_data['ussd_content'] 
        + "&event=continue"
        + "&operator="+ UssdGateway.options.operator

        if (UssdGateway.options.debug == true){
            logger.debug('request_url',request_url)
        }

        request( request_url, function (error, response, body) {
            return UssdGateway.process_gate_way_response(pdu , ussd_data , error, response, body, 17);
        });
    },

    process_gate_way_response:function(pdu , ussd_data,  error, response, body, ussd_service_op ){
       
        msisdn = ussd_data['msisdn'];

        if (UssdGateway.options.debug == true){
            logger.debug('error:', error); 
            logger.debug('statusCode:', response.statusCode); 
            logger.debug('statusCode:', body); 
        }

        let timestampz = Date.now();

        response_data =  {
            timestamp:timestampz,
            msisdn:ussd_data['msisdn'],
            operator:UssdGateway.options.operator,
            short_code:ussd_data["short_code"],
            ussd_service_op:ussd_service_op,
            request_type:"Response USSD",
            gate_way:"USSD"
        }

        if('its_session_info' in pdu){
                    
            session_info = UssdGateway.process_session_info(pdu.its_session_info);
    
            its_session_info = UssdGateway.get_session_info(true , session_info['session_number'] );
    
            if (UssdGateway.options.debug == true){
                logger.debug('sequence_number_new', its_session_info[1] );
                logger.debug('sequence_number_new_binary', ConvertBase.hex2bin(its_session_info[1])  );
                logger.debug('status', session_info['status'] );
                logger.debug('session_number',session_info['session_number']);
                logger.debug('new_session_number',its_session_info[0]);
            }
        }else{
            its_session_info = UssdGateway.get_session_info(true);
        }
        try {
            if (response.statusCode != "200")
            {
                try {
                    body = JSON.parse(body);
                    response_data['message'] = body.message;
                    response_data['display'] = 'terminate';
                    return UssdGateway.send_ussd(msisdn, ussd_data["short_code"] , body.message, {
                        "ussd_service_op": ussd_service_op,
                        "its_session_info": its_session_info
                    });
                }
                catch(err) {
                    response_data['message'] = UssdGateway._error_message;
                    response_data['display'] = 'terminate';
                    rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
                        if (UssdGateway.options.debug == true){ 
                            logger.debug("Rmq response", qResp)
                        }
                        return call();
                    });
                    return UssdGateway.send_ussd(msisdn, ussd_data["short_code"] , UssdGateway._error_message, {
                        "ussd_service_op": ussd_service_op,
                        "its_session_info": its_session_info
                    });
                }
            }
        }
        catch(err) {
            response_data['message'] = UssdGateway._error_message;
            response_data['display'] = 'terminate';
            rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
                logger.debug("Rmq response", qResp)
                return call();
            });
            return UssdGateway.send_ussd(msisdn, ussd_data["short_code"], UssdGateway._error_message, {
                "ussd_service_op": ussd_service_op,
                "its_session_info": its_session_info
            });
        }

        try {
            body = JSON.parse(body);
        }
        catch(err) {
            response_data['message'] = "Invalid Json string gotten";
            response_data['display'] = 'terminate';
            rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
                if (UssdGateway.options.debug == true){ 
                    logger.debug("Rmq response", qResp)
                }
                return call();
            });
            return UssdGateway.send_ussd(msisdn, ussd_data["short_code"] , "Invalid Json string gotten", {
                "ussd_service_op": ussd_service_op,
                "its_session_info": its_session_info
            });
        }

        try {

            if (body.code == '400'){
                response_data['message'] = body.message;
                response_data['display'] = 'terminate';
                rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
                    if (UssdGateway.options.debug == true){ 
                        logger.debug("Rmq response", qResp)
                    }
                    return call();
                });
                return UssdGateway.send_ussd(msisdn, ussd_data["short_code"] , body.message, {
                    "ussd_service_op": ussd_service_op,
                    "its_session_info": its_session_info
                });
            }

            message = body.response.content;
            display = body.response.display;

            if (message.length > UssdGateway.options.character_length){
                response_data['message'] = "ussd character length should be not be greater than "+ UssdGateway.options.character_length+" character"
                response_data['display'] = 'terminate';
                rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
                    if (UssdGateway.options.debug == true){ 
                        logger.debug("Rmq response", qResp);
                    }
                    return call();
                });
                return UssdGateway.send_ussd(msisdn, ussd_data["short_code"] , "ussd character length should be not be greater than "+ UssdGateway.options.character_length+" character", {
                    "ussd_service_op": ussd_service_op,
                    "its_session_info": its_session_info
                });
            }

            response_data['message'] = message;
            response_data['display'] = display;

            rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
                if (UssdGateway.options.debug == true){ 
                    logger.debug("Rmq response", qResp);
                }
                return call();
            });

            if (display == "dialog"){        
                return UssdGateway.send_ussd(msisdn, ussd_data["short_code"], message, {
                    "ussd_service_op": 2,
                    "its_session_info": its_session_info
                });
            }else{
                return UssdGateway.send_ussd(msisdn, ussd_data["short_code"], message, {
                    "ussd_service_op": ussd_service_op,
                    "its_session_info": its_session_info
                });
            }
        }
        catch(err) {
            response_data['message'] = UssdGateway._error_message;
            response_data['display'] = 'terminate';
            rabbit.publish( response_data , config.rabbit_mq.queues.request_log, function(qResp) {
                if (UssdGateway.options.debug == true){ 
                    logger.debug("Rmq response", qResp);
                }
                return call();
            });
            return UssdGateway.send_ussd(msisdn, ussd_data["short_code"], UssdGateway._error_message, {
                "ussd_service_op": ussd_service_op,
                "its_session_info": its_session_info
            });
        }
    }
}

module.exports = UssdGateway;