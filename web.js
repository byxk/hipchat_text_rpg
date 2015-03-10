// data: [ARRAY[HP,PRAYERPOINTS,PRAYERMODIFIER,EXP, LEVEL],ARRAY[ITEMS],ARRAY[ARMOUR]]
var ack = require('ac-koa').require('hipchat');
var pkg = require('./package.json');
var Serializer = require("backpack-node").system.Serializer;
var ser = new Serializer();
var fs = require('fs');
var app = ack(pkg);
var monsterTimer;
var alreadyattacking = false;
var underattack = "";
var hp = 0;
var alreadyrolling = "";
var dict = new JSdict();
var attackdmg = 0;
var chanceOfFaith = false;
var amountofExp = false;
var prayer_process = false;
var inventory_process = false;
var stats_process = false;

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
  var doweatk = (Math.floor(Math.random() * 30) + 1)
  attackdmg = (Math.floor(Math.random() * 20) + 1)
  hp = (Math.floor(Math.random() * 19) + 1)  
  chanceOfFaith = ((Math.floor(Math.random() * 5) + 1) == 2);
  amountofExp = (Math.floor(Math.random() * 10) + 0);
  if (parseInt(doweatk) == 4 ){ 
	saveData(dict);
	initPlayer(this.sender.name);
	alreadyattacking = true;
    underattack = this.sender.name;
	yield this.roomClient.sendNotification("Quickly " + this.sender.name + ", the globin is going after you! Roll a 1d20 and defeat it. You must beat a " + hp);
	console.log("Starting to wait for player " + underattack);
    monsterTimer=setTimeout(function(room, name){ 
		console.log("Monster timed out");
		room.sendNotification(underattack + " took too long to fight back, and nearly died to the monster. 10 hp lost.");
		underattack = "";
		alreadyattacking = false;
		stats = dict.getVal(name)[0];
		stats[0] = parseInt(stats[0]) - 10;
		mainArray = dict.getVal(name);
		mainArray[0] = stats;
		dict.update(name, mainArray);
    }, 30000, this.roomClient, this.sender.name);
 
  }else if (parseInt(doweatk) == 12){
	initPlayer(this.sender.name);
	alreadyattacking = true;
    underattack = this.sender.name;
	yield this.roomClient.sendNotification("Oh no " + this.sender.name + ", the poring is blobbing after you! Roll a 1d20 and defeat it. You must beat a " + hp);
	console.log("Starting to wait for player " + underattack);
    monsterTimer=setTimeout(function(room, name){ 
		console.log("Monster timed out");
		room.sendNotification(underattack + " took too long to fight back, and nearly died to the monster. 10 hp lost.");
		underattack = "";
		alreadyattacking = false;
		stats = dict.getVal(name)[0];
		stats[0] = parseInt(stats[0]) - 10;
		mainArray = dict.getVal(name);
		mainArray[0] = stats;
		dict.update(name, mainArray);
    }, 30000, this.roomClient, this.sender.name);
 
  }  


  return;
});
addon.webhook('room_message',/^\/rpg/i , function *() {
	yield this.roomClient.sendNotification("Available commands: roll|stats|inventory|pepper|rpg")
});

addon.webhook('room_message',/^\/stats/i , function *() {
  if (stats_process) return;
  saveData(dict);
  stats_process = true;
  initPlayer(this.sender.name);
  mainArray = dict.getVal(this.sender.name);
  stats = mainArray[0];
  
  yield this.roomClient.sendNotification(this.sender.name + "'s hp: " + stats[0].toString() + " | Level: " + stats[4] + " | EXP: " + stats[3] +" | pepper: " + stats[1].toString() + " | seasoning modifier: " + stats[2].toString());
  stats_process = false;
});

addon.webhook('room_message',/^\/inventory/i , function *() {
  if (inventory_process) return;
  inventory_process = true;
  initPlayer(this.sender.name);
  mainArray = dict.getVal(this.sender.name);
  inventory = mainArray[1];
  yield this.roomClient.sendNotification(this.sender.name + "'s inventory: " + inventory.toString());
  inventory_process = false;
});

addon.webhook('room_message',/^\/pepper/i , function *() {
  if (prayer_process){
	return;
  }
  saveData(dict);
  prayer_process = true;
  initPlayer(this.sender.name);
  mainArray = dict.getVal(this.sender.name);
  stats = mainArray[0];
  if (stats[1] <= 0){
    yield this.roomClient.sendNotification(this.sender.name + " does not have enough pepper to season.");
  }else{
    var prayermod = (Math.floor(Math.random() * 5));
	stats[1] = stats[1] - 1
	stats[2] = parseInt(stats[2] + prayermod);
	yield this.roomClient.sendNotification(this.sender.name + " successfully seasoned for +" + prayermod.toString() + " modifier on next roll.");
  }
  prayer_process = false;
  
});

addon.webhook('room_message',/^\/roll\s*([0-9]+)?(?:d([0-9]+))?(?:\s*\+\s*([0-9]+))?/i , function *() {
  initPlayer(this.sender.name);
  if (this.sender.name == alreadyrolling) return;
  saveData(dict);
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
  
  } else if (this.match[1] && this.match[2] || !this.match[1] && !this.match[2] && !this.match[3]){
    var totalString = "";
    var total = 0;
	if (!this.match[1] && !this.match[2] && !this.match[3]){
		numofdice = 1;
		numofsides = 20;
		var rand = (Math.floor(Math.random() * parseInt(numofsides)) + 1);
		totalString = rand.toString() + " ";
		total = rand;
	}else{
      for (var i =0 ; i < numofdice ; i++ ){
        var loopRand = (Math.floor(Math.random() * parseInt(numofsides)) + 1);
        totalString = totalString +  loopRand + " ";
        total = total + parseInt(loopRand);
      }
	}
	
	if (this.sender.name == underattack){
	  mainArray = dict.getVal(this.sender.name);
	  stats = mainArray[0]
	  total = total + stats[2];
	  yield this.roomClient.sendNotification(this.sender.name + ' rolled a ' + numofdice + 'd'+ numofsides + '+ seasoning modifier: ' +stats[2].toString() +' ...... [ ' + totalString +'] = ' + total.toString() );
	  
	}else{		
      yield this.roomClient.sendNotification(this.sender.name + ' rolled a ' + numofdice + 'd'+ numofsides + ' ...... [ ' + totalString +'] = ' + total.toString() );
	}
    if ((this.sender.name == underattack) && (this.match[1] == "1") && (this.match[2] == "20")){
	  clearTimeout(monsterTimer);
	  if (total > hp) {
		yield this.roomClient.sendNotification(this.sender.name + ' defeated the monster and gained back ' + Math.floor(attackdmg / 2) + " hp along with " + amountofExp + " exp!");
		stats = dict.getVal(this.sender.name)[0];
		stats[3] = stats[3] + amountofExp;
		amountofExp = 0;
		stats[2] = 0;
		if (stats[1] > 0){	
		  stats[1] = stats[1] - 1;
		}
		stats[0] = parseInt(stats[0]) + Math.floor(attackdmg / 2);
		if (chanceOfFaith){
		  chanceOfFaith = false;
		  yield this.roomClient.sendNotification('The monster dropped some pepper! ' + this.sender.name + ' gained 1 pepper.');
		  stats[1] = stats[1] + 1;
		}
		mainArray = dict.getVal(this.sender.name);
		mainArray[0] = stats;
		dict.update(this.sender.name, mainArray);
		console.log("MAIN ARRAY: " + mainArray.toString());
		alreadyattacking = false;
	  } else{
		yield this.roomClient.sendNotification(this.sender.name + ' lost ' + attackdmg + ' hp!');
		stats = dict.getVal(this.sender.name)[0];
		stats[2] = 0;
		stats[0] = parseInt(stats[0]) - parseInt(attackdmg);
		mainArray = dict.getVal(this.sender.name);
		mainArray[0] = stats;
		dict.update(this.sender.name, mainArray);
		console.log("MAIN ARRAY: " + mainArray.toString());		
		underattack = ""
		alreadyattacking = false;
	  }
		
	}
  } else if (this.match[1]) {
  
    yield this.roomClient.sendNotification(this.sender.name + ' rolled a dice with ' + this.match[1] + ' sides ...... [' + (Math.floor(Math.random() * parseInt(this.match[1])) + 1)+']' );

  }
  alreadyrolling = "";
});

function sleep(milliSeconds){
  var startTime = new Date().getTime(); // get the current time
  while (new Date().getTime() < startTime + milliSeconds); // hog cpu
}
function initPlayer(playername){
  stats = [100, 1,0,0,0,0];
  inventory = ["Sealed rusty pickaxe","",""];
  mainArray = [stats,inventory];
  if (dict.getVal(playername) == "Key not found!"){
	console.log("Creating Player: " + playername);
	dict.add(playername, mainArray);
  }
}
function saveData(file){
	ser.registerKnownType("JSDICT", JSdict);
	var data = ser.stringify(
    {
        dict: dict
    });
	
	fs.writeFile("data", data, function(err) {
    if(err) {
        console.log(err);
    } else {
        console.log("The file was saved!");	
		load = fs.readFileSync("data", 'utf8');
		var deserialized = ser.parse(load);
		console.log(deserialized.dict);
    }
	}); 
}
function loadData(){
  ser.registerKnownType("JSDICT", JSdict);
  var load = fs.readFileSync("data", 'utf8');
  var deserialized = ser.parse(load);
  dict = deserialized.dict;
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
loadData();
app.listen();
