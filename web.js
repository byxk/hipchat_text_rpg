var ack = require('ac-koa').require('hipchat');
var pkg = require('./package.json');
var app = ack(pkg);
var alreadyattacking = false;
var underattack = "";
var hp = 0;
var alreadyrolling = "";
var dict = new JSdict();
var addon = app.addon()
  .hipchat()
  .allowRoom(true)
  .scopes('send_notification');

if (process.env.DEV_KEY) {
  addon.key(process.env.DEV_KEY);
}
addon.webhook('room_message',/.*/i , function *() {
  if (alreadyattacking) {
    return;
  }
  var doweatk = (Math.floor(Math.random() * 20) + 1)
  hp = (Math.floor(Math.random() * 20) + 1)  
  if (parseInt(doweatk) == 4){
	alreadyattacking = true;
    underattack = this.sender.name;
	return yield this.roomClient.sendNotification("Quickly " + this.sender.name + ", the globin is going after you! Roll a 1d20 and defeat it. You must beat a " + hp);
  }
	  
});
addon.webhook('room_message',/^\/stats/i , function *() {
  if (dict.getVal(this.sender.name) == "Key not found!"){
	dict.add(this.sender.name, "100");
  }
  return yield this.roomClient.sendNotification(this.sender.name + "'s hp: " + dict.getVal(this.sender.name));
});
addon.webhook('room_message',/^\/roll\s*([0-9]+)?(?:d([0-9]+))?(?:\s*\+\s*([0-9]+))?/i , function *() {
  if (dict.getVal(this.sender.name) == "Key not found!"){
	  dict.add(this.sender.name, "100");
  }
  if (this.sender.name == alreadyrolling) return;
  alreadyrolling = this.sender.name;
  var numofvars = this.match;
  var numofdice = this.match[1];
  var numofsides = this.match[2];
  var modifier = this.match[3];
  if (parseInt(this.match[1]) > 100) {
    return yield this.roomClient.sendNotification(this.sender.name + " sucks at foosball");
  }
  if (this.match[1] && this.match[2] && this.match[3]) {
    var totalString = "";
    var total = 0;

    for (var i =0 ; i < numofdice ; i++ ){
      var loopRand = (Math.floor(Math.random() * parseInt(numofsides)) + 1);
      totalString = totalString +  loopRand + " ";
      total = total + parseInt(loopRand);
    }
	total = parseInt(total) + parseInt(modifier);
    yield this.roomClient.sendNotification(this.sender.name + ' rolled a ' + numofdice + 'd'+ numofsides + '+' +modifier + ' ...... [ ' + totalString +'] + ' + modifier + ' = ' + total.toString() );
  
  } else if (this.match[1] && this.match[2]){
    var totalString = "";
    var total = 0;
    for (var i =0 ; i < numofdice ; i++ ){
      var loopRand = (Math.floor(Math.random() * parseInt(numofsides)) + 1);
      totalString = totalString +  loopRand + " ";
      total = total + parseInt(loopRand);
    }
		
    yield this.roomClient.sendNotification(this.sender.name + ' rolled a ' + numofdice + 'd'+ numofsides + ' ...... [ ' + totalString +'] = ' + total.toString() );
    if ((this.sender.name == underattack) && (this.match[1] == "1") && (this.match[2] == "20")){
	  if (total > hp) {
		yield this.roomClient.sendNotification(this.sender.name + ' defeated the monster!')
		underattack = ""
		alreadyattacking = false;
	  } else{
		yield this.roomClient.sendNotification(this.sender.name + ' died...')
		underattack = ""
		alreadyattacking = false;
	  }
		
	}
  } else if (this.match[1]) {
  
    yield this.roomClient.sendNotification(this.sender.name + ' rolled a dice with ' + this.match[1] + ' sides ...... [' + (Math.floor(Math.random() * parseInt(this.match[1])) + 1)+']' );

  }
  
  sleep(3000)
  alreadyrolling = "";
});

function sleep(milliSeconds){
  var startTime = new Date().getTime(); // get the current time
  while (new Date().getTime() < startTime + milliSeconds); // hog cpu
}

function JSdict() {
    this.Keys = [];
    this.Values = [];
}

// Check if dictionary extensions aren't implemented yet.
// Returns value of a key
if (!JSdict.prototype.getVal) {
    JSdict.prototype.getVal = function (key) {
        if (key == null) {
            return "Key cannot be null";
        }
        for (var i = 0; i < this.Keys.length; i++) {
            if (this.Keys[i] == key) {
                return this.Values[i];
            }
        }
        return "Key not found!";
    }
}


// Check if dictionary extensions aren't implemented yet.
// Updates value of a key
if (!JSdict.prototype.update) {
    JSdict.prototype.update = function (key, val) {
        if (key == null || val == null) {
            return "Key or Value cannot be null";
        }
        // Verify dict integrity before each operation
        if (keysLength != valsLength) {
            return "Dictionary inconsistent. Keys length don't match values!";
        }
        var keysLength = this.Keys.length;
        var valsLength = this.Values.length;
        var flag = false;
        for (var i = 0; i < keysLength; i++) {
            if (this.Keys[i] == key) {
                this.Values[i] = val;
                flag = true;
                break;
            }
        }
        if (!flag) {
            return "Key does not exist";
        }
    }
}



// Check if dictionary extensions aren't implemented yet.
// Adds a unique key value pair
if (!JSdict.prototype.add) {
    JSdict.prototype.add = function (key, val) {
        // Allow only strings or numbers as keys
        if (typeof (key) == "number" || typeof (key) == "string") {
            if (key == null || val == null) {
                return "Key or Value cannot be null";
            }
            if (keysLength != valsLength) {
                return "Dictionary inconsistent. Keys length don't match values!";
            }
            var keysLength = this.Keys.length;
            var valsLength = this.Values.length;
            for (var i = 0; i < keysLength; i++) {
                if (this.Keys[i] == key) {
                    return "Duplicate keys not allowed!";
                }
            }
            this.Keys.push(key);
            this.Values.push(val);
        }
        else {
            return "Only number or string can be key!";
        }
    }
}

// Check if dictionary extensions aren't implemented yet.
// Removes a key value pair
if (!JSdict.prototype.remove) {
    JSdict.prototype.remove = function (key) {
        if (key == null) {
            return "Key cannot be null";
        }
        if (keysLength != valsLength) {
            return "Dictionary inconsistent. Keys length don't match values!";
        }
        var keysLength = this.Keys.length;
        var valsLength = this.Values.length;
        var flag = false;
        for (var i = 0; i < keysLength; i++) {
            if (this.Keys[i] == key) {
                this.Keys.shift(key);
                this.Values.shift(this.Values[i]);
                flag = true;
                break;
            }
        }
        if (!flag) {
            return "Key does not exist";
        }
    }
}
app.listen();
