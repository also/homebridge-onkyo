var eiscp = require('eiscp');
var util = require('util');

var Service, Characteristic, Receiver, Volume;

function createReceiver() {
  Volume = function() {
    Characteristic.call(this, 'Volume', 'ecfa40c9-95b1-47ce-8439-a3f15c72c53e');
    this.setProps({
      format: Characteristic.Formats.UINT8,
      maxValue: 80,
      minValue: 0,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };

  util.inherits(Volume, Characteristic);

  Receiver = function(displayName, subtype) {
    Service.call(this, displayName, '149db44d-14ac-44fa-92b6-a19ee4cc29b9', subtype);

    this.addCharacteristic(Characteristic.On);
    this.addCharacteristic(Volume);
  }

  util.inherits(Receiver, Service);
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
 
  createReceiver();
 
  homebridge.registerAccessory('homebridge-onkyo', 'Onkyo', OnkyoAccessory);
}

function OnkyoAccessory(log, config) {
  var acc = this;
  eiscp.connect({host: config.host, verify_commands: false});

  eiscp.on('error', log);

  this.service = new Receiver(config.name);
  var informationService = this.informationService = new Service.AccessoryInformation();
  informationService.setCharacteristic(Characteristic.Manufacturer, 'Onkyo');

  var onState = 0;
  var volumeState = 0;

  this.service
    .getCharacteristic(Characteristic.On)
    .on('set', function(newValue, callback) {
      log('Set power ' + newValue);
      eiscp.command('system-power=' + (newValue ? 'on' : 'standby'));
      callback(null);
    })
    .on('get', function(callback) {
      log('get power. currently ' + onState);
      callback(null, onState);
    });
 
  this.service
    .getCharacteristic(Volume)
    .on('set', function(newValue, callback) {
      log('Set volume ' + newValue);
      eiscp.command('volume=' + newValue);
      callback(null);
    })
    .on('get', function(callback) {
      log('get volume. currently ' + volumeState);
      callback(null, volumeState);
    });
 
  eiscp.on('connect', function (host, port, model) {
    informationService.setCharacteristic(Characteristic.Model, model);
    log('Connected to receiver at ' + host + ':' + port);
    eiscp.command('volume=query');
    eiscp.command('system-power=query');
  });

  eiscp.on('volume', function(newVolume) {
    log('Volume changed to ' + newVolume);
    volumeState = newVolume || 0;
  });

  eiscp.on('system-power', function(newPower) {
    newPower = newPower === 'on' ? 1 : 0;
    log('Power changed to ' + newPower);
    onState = newPower;

    eiscp.command('volume=query');
  });
}

OnkyoAccessory.prototype.getServices = function() {
  return [this.service, this.informationService];
}
