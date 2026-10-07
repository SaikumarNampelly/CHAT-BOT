const dns = require('dns');
const { createClient } = require('@supabase/supabase-js');

// Bypass ISP DNS hijacking of *.supabase.co (e.g. routing to non-TLS ISP IP 183.82.14.22)
const origLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname && hostname.includes('supabase.co')) {
    if (options && options.all) {
      return callback(null, [
        { address: '104.18.38.10', family: 4 },
        { address: '172.64.149.246', family: 4 },
      ]);
    }
    return callback(null, '104.18.38.10', 4);
  }
  return origLookup.call(this, hostname, options, callback);
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
