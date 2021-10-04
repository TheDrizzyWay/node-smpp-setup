require('dotenv').config();
const EncryptedMsisdn = require('./lib/encrypted_msisdn');
// const MySql = require('./lib/my_sql');
// MySql.init();
//08099444176 mr bunmi




(async () => {
    try{

        await require('./lib/oracle').init();


        const a = new EncryptedMsisdn('08099999999', false);
        console.log('decrypted '+a.decrypted)
        const date = new Date();

       
        const b = await a.getEncryptedMsisdn()

        const date2 = new Date();
        console.log(`finished in ${(date2.getTime() - date.getTime())/1000} seconds`)

        console.log('encrypted ' +b)
        const c = await new EncryptedMsisdn(b).getMsisdn();
        console.log('decrypted 2 ' +c)
    } catch(e){
        console.error('err')
        console.error(e)
    }

})()
