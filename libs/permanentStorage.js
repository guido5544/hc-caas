const config = require('config');

exports.getStorage = () => {

  if (config.get('hc-caas.storage.type').toLowerCase() == 's3')
  {
    storage = require('./permanentStorageOptions/permanentStorageS3');
    storage.initialize();
  }
  else if (config.get('hc-caas.storage.type').toLowerCase() == 'abs')
  {
    storage = require('./permanentStorageOptions/permanentStorageABS');
    storage.initialize();
  }
  else  {
    storage = require('./permanentStorageOptions/permanentStorageFS');
  }
  return storage;
};