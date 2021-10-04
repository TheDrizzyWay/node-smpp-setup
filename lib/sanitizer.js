

class Sanitizer {
    /**
     * Used to normalize the passed in MSISDN
     *
     * @param {String} phoneNumber MSISDN
     * @param {Boolean} includePlus Boolean deciding whether to include + as the MSISDN prefix
     * @param {String} countryCode indicates the country dialing code for the MSISDN
     * @returns {String} msisdn
     */
    static normalizeMSISDN(phoneNumber, includePlus = false, countryCode = '234') {
        let msisdn = phoneNumber;

        if (!msisdn) { return ''; }
        if (msisdn.length === 14) {
            msisdn = `${countryCode}${msisdn.substr(4)}`;
        }
        msisdn = msisdn.replace(/\s+/g, '');
        msisdn = msisdn.replace('+', '');
        if (Number.isNaN(msisdn)) {
            return '';
        }

        if (msisdn.match(/^234/i)) {
            msisdn = `0${msisdn.substr(3)}`;
        }
        if (msisdn.length === 11) {
            msisdn = `+${countryCode}${msisdn.substr(1)}`;
            if (!includePlus) {
                msisdn = msisdn.replace('+', '');
            }
            return msisdn;
        }
        return '';
    }


}

module.exports = Sanitizer;
