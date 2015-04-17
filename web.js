// data: [ARRAY[HP,PEPPERPOINTS,SEASONINGMOD,EXP, LEVEL, GOLD],ARRAY[ITEMS],ARRAY[CLASSNAME, numOfReRolls, target, warrior mod]]
// data v2: [main: [hp, pepperpoints, mod, exp, lvl ,gold]
//           inventory: [items]
//           classInfo: [name, rerolls, target, classMod] 
//           profile: [playerName, "characterName", "","","",""]
//           ]
var rareItems = ["Shiny spatula", "Chef's Apron"];
var rareItemsEffects = ["Passively increase seasoning mod by 20%", "Decrease damage taken by 10%"];
var typesOfMonsters = ["globin", "poring", "Ghostly Josh", "Headless Jimmy", "Spooky Jennie", 
"Playboy Rob", "Mad Patrick", "Crazy Leo", "Sad Caledonia", 
"Master Imran", "Giant Josh", "Grapefruit Jimmy", "Fried Rob", "Potato Leo",
"Chicken Jennie", "Soup Caledonia", "Icecream Imran", "Sandwich Patrick"];
var foodDrops = ["an Apple", "a Potato", "Jimmy's sandwich", "Josh's bacon", "Jennie's fruit punch", "Rob's pills", "Patrick's JapaDog", "Leo's Monopoly", "Caledonia's Waterbottle", "Imran's Resume"];
var classTypes = ["Cleric", "Mage", "Princess", "Warrior"];
var ack = require('ac-koa').require('hipchat');
var pkg = require('./package.json');
var app = ack(pkg, {store: 'MongoStore'});
var MongoStore = require('ac-node').MongoStore;
var addonStore = MongoStore(process.env[app.config.MONGO_ENV], 'dice');
var fs = require('fs');
var app = ack(pkg);
var http = require('http');
var monsterTimer;
var alreadyattacking = false;
var underattack = "";
var alreadyrolling = "";
var hp;
var attackdmg;
var chanceOfFaith = false;
var amountofExp = false;
var statsAll = false;
var globalEnc = 20;
var monsterType = "";
var monsterfoodDrop = "";
var playerDiceType;
var mainTimerDuration = 300000;
var gainHP;
var increaseMonsterChance = new Array();
var gMonsterChance = new Array();
var diceToRoll = 0;
var pollObj = {
    started: false,
    question: "",
    options: [],
    players: [],
    votes: [],
    starter: ""
}
var topScoresAll = {
    expPlayers: ["","",""],
    expScores: [0,0,0],
    goldPlayers: ["","",""],
    goldScores: [0,0,0],
    pepperPlayers: ["","",""],
    pepperScores: [0,0,0]
}
var duelObj = new duelObject();
var levelofMob = 1;
var prayer_process = false;
var inventory_process = false;
var monsterBossMethod;
var bossMonsterParty = {
    hp: [],
    attackdmg: [],
    playersIn: [],
    playersRoll: [],
    expGain: 0,
    goldGain: 0,
    hpGain: 0,
    store: "",
    totalRoll: 0,
    target: "",
    playerNames: []
};
var monsterGracePeriod = function (){
    logToFile("alreadyattacking to false");
    alreadyattacking = false;
}
var monsterGracePeriodTmr;
var isBossFight = false;
var monsterBossTimer;
var stats_process = false;
var globalMonTimer;
var globalMonClear;
var monsterGoldDrop;
var gTarget = {name:""};
var peopleInRoom;
var globalRoom;
var shop_process;
var addon = app.addon()
	.hipchat()
	.allowRoom(true)
	.scopes('send_notification');
if (process.env.DEV_KEY) {
	addon.key(process.env.DEV_KEY);
}

String.prototype.startsWith = function(prefix) {
    return this.indexOf(prefix) === 0;
}    
function isInArray(value, array){
    if (array == "undefined"){
        return false;
    }else{
        return array.indexOf(value) > -1;
    }
}

addon.webhook('room_message', /^\/shop\s*([a-z]+)?\s*([a-z]+)?\s*([0-9]+)?/i, function  * () {
    if (shop_process){
        return
    }
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);

    shop_process = true;
    if (matchString[1] != "buy" || !matchString[2] ){
        printMessage("Buy and use an item automatically with /shop buy itemname.", "green", this.roomClient);
        printMessage("HealthPotion - 15g | Pepper - 5g | Bayleaf - 5g | Dueltoken - 20g", "green", this.roomClient);
        shop_process = false;
        return;
    }
    var buyingItem = matchString[2];
    // just gonna have a static shop for now
    var stats = getUser.main
    var playerGold = parseInt(stats[5]);
    var playerClass = getUser.classInfo
    var inventory = getUser.inventory
    logToFile("In shopbuying: " + stats)
    if (matchString[2] == "healthpotion"){
        if (15 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 15;
            // hp heals for 30
            stats[0] += 30;
            getUser.main = stats;
            getUser = updatePlayer(getUser, this, senderId)
            shop_process = false;
            return yield printMessage("HP potion bought and used automatically, +30hp.", "green", this.roomClient);
        }
    } else if (matchString[2] == "pepper"){
        var amountOfPeppers = 1;
        matchString[3] = escape(matchString[3]);
        if (matchString[3] != ""){
            amountOfPeppers = parseInt(matchString[3]);
        }
        if (isNaN(amountOfPeppers)) amountOfPeppers = 1;
        if ((5*amountOfPeppers) > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{

            stats[5] = stats[5] - (5*amountOfPeppers);
            stats[1] = stats[1] + amountOfPeppers;
            getUser.main = stats;
            updatePlayer(getUser, this, senderId)
            shop_process = false;
            pepperTopScore(senderName, stats[1], this.roomClient);
            return yield printMessage(amountOfPeppers + " pepper(s) bought and stored.", "green", this.roomClient);  
        }
    }else if (matchString[2] == "bayleaf"){
        if (5 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 5;
            // hp heals for 30
            playerClass[1] += 1;
            getUser.main = stats;
            updatePlayer(getUser, this, senderId)
            shop_process = false;
            return yield printMessage("Bay leaf bought and stored.", "green", this.roomClient);  
        }
    }else if (matchString[2] == "dualtoken"){
        if (20 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 20;
            inventory.push("dualtoken");
            getUser.inventory = inventory;
            updatePlayer(getUser, this, senderId)
            shop_process = false;
            return yield printMessage("Dualtoken bought and stored in inventory.", "green", this.roomClient); 
        }

    }else{
        shop_process = false;
        return yield printMessage("No such item exists.", "green", this.roomClient);
    }


    shop_process = false;
});
// data: [ARRAY[HP,PEPPERPOINTS,SEASONINGMOD,EXP, LEVEL, GOLD],ARRAY[ITEMS],ARRAY[CLASSNAME, numOfReRolls, target, warrior mod]]
addon.webhook('room_message', /^\/gm\s+(?:(\S+)\s+)*/i, function  * () {
    if (this.sender.name != "Patrick Tseng") return;
    logToFile(this.match[1])
    var matchString = this.match;
    var senderId = this.sender.id;
    var store = yield this.tenantStore.all(10000);
    if (matchString[1] == "save"){
        var fs = require('fs');
        fs.writeFileSync("data.json", JSON.stringify(store), 'utf8');

    }else if (matchString[1] == "load"){
        var fs = require('fs');
        var obj = fs.readFileSync('data.json', 'utf8')
        logToFile(obj.toString())
        var jsonObj = JSON.parse(obj);
        logToFile(jsonObj.toString());
        for (var i in jsonObj){
            logToFile("Loading playerObj from file: " + i.toString());
            logToFile("Loading playerObjData from file: " + jsonObj[i].toString());
            updatePlayer(jsonObj[i], this, i.toString());
        }
    }
    

    return yield printMessage("done", "green", this.roomClient, "text");

});
addon.webhook('room_message', /^\/target\s*([\S\s]*)$/i, function  * () {
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var store = yield this.tenantStore.all(100000);
    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);

    var pclass = getUser.classInfo;
    var target = matchString[1];
    if (!matchString[1]){ 
        return yield printMessage("@" +senderMentionName + " is currently targeting " + pclass[2] + ".", "green", this.roomClient, "text") 
    }
    // if (pclass[0] != "Cleric"){
    //     return yield printMessage("Must be a {Cleric} to use this feature.", "red", this.roomClient, "text")
    // }
    logToFile("Attempting to target " + matchString[1]);
    if (getIdFromName(this, matchString[1], store) == -1){
        return yield printMessage(matchString[1] + " could not be found!", "green", this.roomClient);
    }
    yield printMessage("@" + senderMentionName + " targeted " + matchString[1] + ".", "green", this.roomClient, "text")
    pclass[2] = target.toString();
    getUser.classInfo = pclass;
    updatePlayer(getUser, this, senderId);
});

addon.webhook('room_message', /^\/class\s*([a-z]+)?/i, function  * () {
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);
    var pclass = getUser.classInfo;
	if (matchString[1] == "plsgivemesomethinggood"){
	

		if (parseInt(pclass[1]) <= 0){
            return printMessage(senderName +"'s class has been chosen already. You cannot change destiny.", "red", this.roomClient);
        } 
        pclass[1] -= 1;
		chosenClass = classTypes[Math.floor(Math.random() * classTypes.length)];
		printMessage(senderName + "'s rolls the destiny dice and is chosen as a......<b>" + chosenClass + "</b>!!!!", "green", this.roomClient);
		pclass[0] = chosenClass;
        pclass[2] = "";
        pclass[3] = 0;
		getUser.classInfo = pclass;
        updatePlayer(getUser, this, senderId);
		return;

	}else{
		printMessage("Available classes: Cleric, Mage, Warrior, Princess. Choose with /class plsgivemesomethinggood. @" +
            senderMentionName + " has " + pclass[1] + "x [Bay leaf] left!", "yellow", this.roomClient, "text");
	}

});
addon.webhook('room_message', /^\/duel*\s*([a-z]+)\s*([a-z\s]*)\s*([0-9]*)$/i, function  * () {
    if (alreadyattacking && !duelObj.status){
        return;
    }
    //matchString[1] == "accept" && senderName == duelObj.playerTwo && duelObj.waitingForAccept
    
    logToFile("DUELNAME: "  + duelObj.playerTwo);
    logToFile("senderName: "  + this.sender.name);
    logToFile("waitingaccept: " + duelObj.waitingForAccept);
    // cmds for [1] = 
    // "start" - start a duel
    // "bet" - place down a bet on a current duel
    var matchString = this.match;
    for (var str in matchString){
        matchString[str] = matchString[str].toString().trim();
    }
    logToFile("MATCHSTRING: "  + matchString);
    var store = yield this.tenantStore.all(100000);
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);
    var playerInventory = getUser.inventory
    if (matchString[1] == "bet"){
        if (!duelObj.bettingPhase){
            return yield printMessage("Not in betting phase.", "yellow", this.roomClient, "text");
        // }else if (senderName == duelObj.playerOne || senderName == duelObj.playerTwo) {
        //     return yield printMessage("Duelers can't bet!", "yellow", this.roomClient, "text");
        }else if (isInArray(senderName, duelObj.playerOneBetters) || isInArray(senderName, duelObj.playerTwoBetters)) {
            return yield printMessage("You've already bet!", "yellow", this.roomClient, "text");
        } else {
            if (matchString[2] == ""){
                return yield printMessage("Need to specify player to bet on.", "yellow", this.roomClient, "text");
            }else if (!isNumeric(matchString[3])){
                return yield printMessage("Need to specify a proper number", "yellow", this.roomClient, "text");
            }else if ( matchString[2] != duelObj.playerOne && matchString[2] != duelObj.playerTwo){
                logToFile("match String and player one " + ((matchString[2] != duelObj.playerOne)||(matchString[2] != duelObj.playerTwo)));
                return yield printMessage("Need to bet on a dueler.", "yellow", this.roomClient, "text");
            }else{
                var betAmount = parseInt(matchString[3]);
                if (betAmount > getUser.main[5]){
                    return yield printMessage("Don't have enough gold to bet that amount!", "yellow", this.roomClient, "text");
                }
                getUser.main[5] -= betAmount;
                updatePlayer(getUser, this, senderId)
                if (matchString[2] == duelObj.playerOne){
                    duelObj.playerOneBetters.push(senderName);
                    duelObj.playerOneBettersBets.push(betAmount);      
                    duelObj.playerOneTotalBets += betAmount;       
                }else{
                    duelObj.playerTwoBetters.push(senderName);
                    duelObj.playerTwoBettersBets.push(betAmount);      
                    duelObj.playerTwoTotalBets += betAmount;       
                }

                return yield printMessage(senderName + " has put down a bet of " + betAmount.toString() + " on " + matchString[2]+".", "yellow", this.roomClient, "text");
            }

            return;
        }
    }else if (matchString[1] == "start"){
        if (duelObj.status){
            return yield printMessage("Another duel is currently in progress", "yellow", this.roomClient, "text");
        }else{
            if (matchString[2] == ""){
                return yield printMessage("Need to specify player to duel", "yellow", this.roomClient, "text");
            } else if (getIdFromName(this,matchString[2],store) == -1){
                return yield printMessage("Player doesn't exist.", "yellow", this.roomClient, "text");
            } else if (senderName == matchString[2]){
                return yield printMessage("Can't challenge yourself!", "yellow", this.roomClient, "text");
            
            } else {
                duelObj = new duelObject(store);
                duelObj.status = true;
                duelObj.waitingForAccept = true;
                alreadyattacking = true;
                duelObj.playerOne = senderName;
                duelObj.playerTwo = matchString[2];
                // TODO: PlayerTwo must accept
                yield printMessage("Waiting 1 minute for " + duelObj.playerTwo +" to accept. Must type /duel accept", "green", this.roomClient, "text")
                var waitingDuel = function (room){
                    room.sendNotification("Dueler did not accept in time, cancelling duel.");
                    duelObj = new duelObject();
                }
                duelObj.duelAcceptTimer = setTimeout(waitingDuel, 60000, this.roomClient);
                return;

            }
        }

    }else if (matchString[1] == "accept" && senderName == duelObj.playerTwo && duelObj.waitingForAccept){
        clearTimeout(duelObj.duelAcceptTimer);
        duelObj.waitingForAccept = false;
        duelObj.bettingPhase = true;
        yield printMessage("Everyone has 10 seconds to place a bet.", "green", this.roomClient, "text")

        var bettingFunction = function (room, rollingFunction,self,store){
            duelObj.bettingPhase = false;
            duelObj.attackingphase = true;
            duelObj.duelRollTimer = setTimeout(rollingFunction, 30000, room, self, store);
            room.sendNotification("End of betting phase. Duelers have 30s to roll.");
        }

        var rollingFunction = function(room, self,xx){
            
            var store = duelObj.store;
            if (duelObj.playerOneRoll == 0 && duelObj.playerTwoRoll == 0 ){
                room.sendNotification("No one rolled, cancelling duel.");
                alreadyattacking = false;
                    duelObj = new duelObject();
            }else{
                if (duelObj.playerOneRoll > duelObj.playerTwoRoll){
                    // playerOne wins   
                    var messageToSend = "";
                    room.sendNotification(duelObj.playerOne + " wins the duel! Anyone who betted on the winner gets their amount back + portion of the bets placed on the loser.");
                    var totalBets = duelObj.playerTwoTotalBets;
                    var portion = totalBets / duelObj.playerOneBetters.length;
                    messageToSend += "Total amounts of the pool is " + totalBets + ", split " + duelObj.playerOneBetters.length + " ways.\n"
                    for ( var i = 0; i < duelObj.playerOneBetters.length; i++){
                        var totalWon = duelObj.playerOneBettersBets[i] + portion;
                        messageToSend += duelObj.playerOneBetters[i] + " has won " + totalWon.toString() + "\n";
                        var user = store[getIdFromName(self, duelObj.playerOneBetters[i],store)];
                        user.main[5] += totalWon;
                        updatePlayer(user, self, getIdFromName(self,duelObj.playerOneBetters[i], store));
                    }

                }else if (duelObj.playerTwoRoll > duelObj.playerOneRoll){
                    // playertwo wins
                    room.sendNotification(duelObj.playerTwo + " wins the duel!");
                    var messageToSend = "";
                    room.sendNotification(duelObj.playerTwo + " wins the duel! Anyone who betted on the winner gets their amount back + portion of the bets placed on the loser.");
                    var totalBets = duelObj.playerOneTotalBets;
                    var portion = totalBets / duelObj.playerTwoBetters.length;
                    messageToSend += "Total amounts of the pool is " + totalBets + ", split " + duelObj.playerTwoBetters.length + " ways.\n"

                    for ( var i = 0; i < duelObj.playerTwoBetters.length; i++){
                        var totalWon = duelObj.playerTwoBettersBets[i] + portion;
                        messageToSend += duelObj.playerTwoBetters[i] + " has won " + totalWon.toString() + "\n";
                        var user = store[getIdFromName(self, duelObj.playerTwoBetters[i], store)];
                        user.main[5] += totalWon;
                        updatePlayer(user, self, getIdFromName(self, duelObj.playerTwoBetters[i], store));
                    }
                    printMessage(messageToSend, "yellow", room, "text");

                }
                alreadyattacking = false;
                    duelObj = new duelObject();
            }
        }
        duelObj.store = yield this.tenantStore.all(100000);
        duelObj.duelBetTimer = setTimeout(bettingFunction, 30000, this.roomClient, rollingFunction, this, duelObj.store);
    return;

    }else{
        return yield printMessage("/duel start|bet playername", "yellow", this.roomClient, "text");
    }
    
});
addon.webhook('room_message', /^[^\/].*|^\/farm|^\/help|^\/ping|^\/profile\s*([a-z]+)?\s*([a-z]+)?|^\/poll*\s*([a-z]+)\s*([\S\s]*)$/i, function  * () {
   if (this.match[0] == "/help" && !statsAll){
    statsAll = true;
    var message = "";
    message += "<b>/help for The Newbies Room(tm)(r)(uh)</b><br>";
    message += "<b>ping</b> - Check the time it takes for HC to recieve your message.<br>";
    message += "<b>ready</b> - Ready up.<br>";
    message += "<b>/poll start|vote|add</b> - Start a poll, vote for an option, add an entry. Requires a third arg.<br>";
    message += "<b>/roll xdx+x</b> - roll a dice with (#ofdice)d(#ofsides) + (modifier). Default is 1d20.<br>";
    message += "<b>/farm</b> - triggers a monster encounter when prompted.<br>";
    message += "<b>/profile nick {name}</b> - Changes nickname of character, leaving blank sets back to default.<br>";
    message += "<b>/shop |buy {item}</b> - Shows list of items to buy | buy and use an item.<br>";
    message += "<b>/target {playername}</b> - Targets a player, used for target-only skills.<br>";
    message += "<b>/class |plsgivemesomethinggood</b> - Shows status of class | roll for a random class.<br>";
    message += "<b>/stats | all | top | alltime</b> - Shows stats | Shows stats of everyone | Shows top players | Shows all time top players.<br>";
    message += "<b>/inventory</b> - Shows obtained items.<br>";
    message += "<b>/pepper</b> - Uses peppers, can specify amount of peppers to use.<br>";
    yield printMessage(message, "gray", this.roomClient, "html");

    statsTimer = setTimeout(function (room) {
                logToFile("stats all is ready");
                statsAll = false;
            }, 60000, this.roomClient);
    return;
   }
    var voteOptionMsg = "";
    if (this.match[0].startsWith("/poll") && this.match[3] == "start" && this.match[4]){
        pollObj = {
            started: false,
            question: this.match[4],
            options: [],
            players: [],
            votes: [],
            starter: this.sender.name
        }
        yield printMessage("Question added, type /poll add {option} to add an entry.", "yellow", this.roomClient, "text");
        return;
    }else if (this.match[0].startsWith("/poll") && this.match[3] == "add" && this.match[4] != "" && pollObj.question != "" && pollObj.starter == this.sender.name){
        if (isInArray(this.match[4], pollObj.options)){
            return;
        }
        pollObj.started = true;
        pollObj.options.push(this.match[4]);
        pollObj.votes.push(0);
        yield printMessage("Entry added. Keep typing /poll add {option} to add more, or /poll vote {number} to vote for 1", "yellow", this.roomClient, "text");
        return;
    } else if (this.match[0].startsWith("/poll") && this.match[3] == "vote" && this.match[4] != "" && pollObj.started){
        logToFile(isNumeric(this.match[4]));
        if (isInArray(this.sender.name, pollObj.players) || !(isNumeric(this.match[4]))){
            logToFile("isInPlayers and numeric");
            return;
        }
        var number = parseInt(this.match[4]);
        if (number <1 || number > pollObj.options.length){
            logToFile("toogreaterormsallers");
            return;
        }
        pollObj.players.push(this.sender.name);
        pollObj.votes[number-1] += 1;
        yield printMessage("Vote Added.", "yellow", this.roomClient, "text");

        return;
    } else if (this.match[0].startsWith("/poll") && this.match[3] == "status" && pollObj.started){
        yield printMessage("<b>Current Question:</b> " + pollObj.question + "\n", "yellow", this.roomClient, "html");
        for (var i = 0; i<pollObj.options.length; i++){
            logToFile(pollObj.options[i]);
            voteOptionMsg += (i+1).toString() + ") " + pollObj.options[i] + ": " + pollObj.votes[i] + " votes.\n".toString();
        }
        logToFile(voteOptionMsg);
        yield printMessage("Available options: \n", "yellow", this.roomClient, "text");
        yield printMessage(voteOptionMsg,"yellow", this.roomClient, "text");
        return;
    }
    if (this.match[0] == "ping"){
        var timeDiff = Date.now() -Date.parse(this.message.date);
        yield printMessage("@" +this.sender.mention_name+"'s pong - " + timeDiff.toString() + "ms", "yellow", this.roomClient, "text");
        return;
    }
    if (this.match[0] == "ready"){
        yield printMessage("@" +this.sender.mention_name+" is ready.", "yellow", this.roomClient, "text");
        return;
    }

    var room = this.roomClient;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);

    var dataBase = yield this.tenantStore.all(10000);

    if (!globalMonTimer){
        logToFile("In Timer setup");
        globalMonTimer = setInterval(function(roomC, tar) {
            var today = new Date().getHours();
            var day = new Date().getDay();
            logToFile("Current hour: " + today);
            logToFile("Current day: " + day);
            // time on vm
            if (today <= 24 && today >= 17 && !alreadyattacking && (day != 0) && (day != 7) && (underattack == "")) {

                var rand = Math.floor(Math.random() * gMonsterChance.length)
                logToFile("Rand is currently: " + rand.toString());
                logToFile("ArraySze is currently: " + gMonsterChance.length.toString());
                gTarget.name = gMonsterChance[rand];
                if (gTarget.name != "undefined"){
                    logToFile("Target is currently: " + gTarget.name);
                    printMessage("@"+gTarget.name + " hears something rustle in the tall grass...poke ball ready...", "purple", roomC, "text");
                    globalEnc = 21;
                    gMonsterChance.splice(rand, 1);
                    globalMonClear = setTimeout(function (tar) {
                        logToFile("grass timed out");
                        gTarget.name = "";
                        if (gMonsterChance.length == 0){
                            fillMonsterChanceArray();
                            logToFile("Monster array is currently: " + gMonsterChance);
                        }
                    }, 60000, gTarget);
                }
            }
        }, 600000, this.roomClient, gTarget)

    }
    if (matchString[0].startsWith("/profile")){
        if (matchString[1] == "nick"){
            if (!matchString[2]){
                getUser.profile[1] = "";
                updatePlayer(getUser, this, senderId);
                return yield printMessage("@" + senderMentionName + "'s character nickname has been updated.", "green", this.roomClient, "text");
            }
            var nickName = escape(matchString[2].replace(" ", ""));
            if (nickName.length > 16){
                return yield printMessage("Name too long! Must be shorter than 15 characters.", "red", this.roomClient, "text");
            }else if (nickName == "" ){
                return yield printMessage("Name too short! Must be at least 1 character.", "red", this.roomClient, "text");
            }
            getUser.profile[1] = nickName;
            updatePlayer(getUser, this, senderId);
            return yield printMessage("@" + senderMentionName + "'s character nickname has been updated.", "green", this.roomClient, "text");

        }
    }
    if (alreadyattacking) {
        return;
    }  
    var trigger = false;
    if ((matchString[0] == "/farm") && (globalEnc == 21) && (senderMentionName == gTarget.name)){
        logToFile("In /farm");
        globalEnc = 0;
        trigger = true;
    }

    if (!increaseMonsterChance[senderName] && (senderName != "$")){
        increaseMonsterChance[senderName] = 1;
    }
	var doweatk = randFromRange(increaseMonsterChance[senderName], 18);
    logToFile("Monster encounter rolls: " + doweatk.toString());
	if ((parseInt(doweatk) == 17 || trigger) && !alreadyattacking) {

		alreadyattacking = true;
		underattack = senderName;
		// lets get player level
        clearTimeout(globalMonClear);
		var playerLevel = getUser.main[4];
        if ((playerLevel - 2) <=0) {
            levelofMob = 1
        }else{
		  levelofMob = randFromRange(playerLevel-2, (playerLevel +1));
        }
        attackdmg = (rollDice(Math.ceil(parseInt(levelofMob)/2),8,0));
        // boss
        var isBossMonster = randFromRange(1,5);
        if (isBossMonster == 2){
            isBossFight = true;
            levelofMob = levelofMob*2;
            attackdmg = (rollDice(Math.ceil(parseInt(levelofMob)/3),8,0));
            logToFile("The monster rolled: " + attackdmg.toString());
            // stats from boss
            var maxHp = Math.floor(levelofMob*7);
            hp = randFromRange(levelofMob*5, maxHp);
            logToFile("HP of boss monster :" + hp);
            logToFile("Level of boss monster: " + levelofMob);
            gainHP = Math.ceil(attackdmg[0] * .60);
            if (gainHP == "Infinity"){
                gainHP = 1;
            }
            logToFile("GainHp Boss: " + gainHP);
            amountofExp = Math.floor(randFromRange(50,100)*levelofMob);
            monsterGoldDrop = randFromRange(levelofMob/2,levelofMob) * 2;
            monsterType = typesOfMonsters[Math.floor(Math.random() * typesOfMonsters.length)];
            monsterfoodDrop = foodDrops[Math.floor(Math.random() * foodDrops.length)];
            yield printMessage("A low rumbling in the distance is heard...and @" + senderMentionName +" sees a giant " + monsterType +", level " + levelofMob.toString() + ". The party has 2 minutes to roll, and must beat " + hp + ", @here. Rolling for attack damage.", "red", this.roomClient, "text");
            yield printMessage(formatRoll(Math.ceil(levelofMob/3), 8, 0, attackdmg, monsterType), "red", this.roomClient, "text");
            bossMonsterParty.hp = hp;
            bossMonsterParty.attackdmg = attackdmg;
            bossMonsterParty.expGain = amountofExp;
            bossMonsterParty.goldGain = monsterGoldDrop;
            bossMonsterParty.hpGain = gainHP;
            bossMonsterParty.store = dataBase;
            bossMonsterParty.target = senderId;
            var that = this;

            monsterBossMethod = function(){
                dataBase = bossMonsterParty.store;

                isBossFight = false;
                if (underattack != ""){
                    if (bossMonsterParty.playersIn.length == 0){
                        room.sendNotification("No one challenged the boss, and it hunkered away.");

                    }else if (bossMonsterParty.playersIn.length > 0){
                        logToFile("Length of playersIn: " + bossMonsterParty.playersIn.length);
                        var totalRolls = 0;
                        for (var i = 0; i < bossMonsterParty.playersRoll.length; i++){
                            totalRolls += bossMonsterParty.playersRoll[i];
                        }
                        if (totalRolls >= bossMonsterParty.hp){
                            logToFile("Boss Monster Loses");
                            room.sendNotification(bossMonsterParty.expGain.toString() + " exp is split between everyone who rolled. " + bossMonsterParty.playerNames.toString() + " also gains " + bossMonsterParty.hpGain.toString() + "hp, and " + bossMonsterParty.goldGain.toString() + " gold.");
                            var splitExp = Math.ceil(bossMonsterParty.expGain / bossMonsterParty.playersIn.length)
                            for (var i = 0; i < bossMonsterParty.playersIn.length; i++){
                                var getUser = dataBase[bossMonsterParty.playersIn[i]];
                                getUser.main[0] += bossMonsterParty.hpGain;
                                getUser.main[5] += bossMonsterParty.goldGain;
                                getUser.main[3] += splitExp;
                                getUser.main[2] = 0;


                                var currentLevel = getUser.main[4];
                                getUser.main[4] = calcLevel(getUser.main[3])
                                if (currentLevel < getUser.main[4]){
                                    room.sendNotification("@" + getUser.profile[0] + " has leveled up and is now level " + getUser.main[4].toString() + ". +50hp.", {
                                       color : 'purple',
                                       format : 'text'
                                    });
                                    getUser.main[0] += 50;
                                }
                                updatePlayer(getUser, that, bossMonsterParty.playersIn[i]);
                            }

                        }else{
                            logToFile("Boss Monster wins");
                            room.sendNotification("The party loses to the boss, and takes " + bossMonsterParty.attackdmg[0] + " damage.");
                            for (var i = 0; i < bossMonsterParty.playersIn.length; i++){

                                logToFile("ID Boss: " + bossMonsterParty.playersIn[i]);
                                var getUser = dataBase[bossMonsterParty.playersIn[i]];
                                logToFile("ID Boss Player: " +JSON.stringify(getUser));
                                getUser.main[0] -= bossMonsterParty.attackdmg[0];
                                getUser.main[2] = 0;
                                if (parseInt(getUser.main[0]) <= 0){
                                    logToFile("Dead player");
                                    room.sendNotification("Uh oh someone has died.", {
                                       color : 'red',
                                       format : 'text'
                                    });
                                    delPlayer(that, bossMonsterParty.playersIn[i]);
                                }else{
                                    updatePlayer(getUser, that, bossMonsterParty.playersIn[i]);
                                }
                            }

                        }
                    }
                    bossMonsterParty = {
                        hp: [],
                        attackdmg: [],
                        playersIn: [],
                        playersRoll: [],
                        expGain: 0,
                        goldGain: 0,
                        hpGain: 0,
                        store: "",
                        totalRoll: 0,
                        target: "",
                        playerNames: []
                    }
                    logToFile("Boss Monster end");
                    underattack = "";
                    monsterGracePeriodTmr = setTimeout(monsterGracePeriod, 60000);
                    trigger = false

            }

        }
            monsterBossTimer = setTimeout(monsterBossMethod, 120000);
        }else {
    		//attackdmg = rollDice(1,8,0);

            var maxHp = Math.floor(levelofMob*2*.75);
    		hp = randFromRange(playerLevel, maxHp);

            gainHP = hp;
            if (gainHP == "Infinity"){
                gainHP = 1;
            }
            logToFile("GainHp: " + gainHP);
    		chanceOfFaith = (randFromRange(1,4)== 2);
    		amountofExp = Math.floor(randFromRange(1,10)*levelofMob*.70);
            monsterGoldDrop = randFromRange(levelofMob/3,levelofMob);
    		monsterType = typesOfMonsters[Math.floor(Math.random() * typesOfMonsters.length)];
    		monsterfoodDrop = foodDrops[Math.floor(Math.random() * foodDrops.length)];

            yield printMessage("Quickly @" + senderMentionName + ", the lvl "
                + levelofMob.toString()
                + " " + monsterType + " appeared! Roll more than: " + hp.toString() + " | It will deal: " + attackdmg[0].toString() + " dmg.","red", this.roomClient,"text");
            logToFile("Attack Damage in first enc: " + attackdmg.toString())
    		logToFile("Starting to wait for player " + underattack);
    		monsterTimer = setTimeout(function (room, id, playerObject, self) {
                if (underattack != ""){
                    var getUser = playerObject;
    				logToFile("Monster timed out");
    				room.sendNotification(underattack + " took too long to fight back, and nearly died to the monster. "+ attackdmg[0]+ "hp lost.");
    				underattack = "";
                    monsterGracePeriodTmr = setTimeout(monsterGracePeriod, 30000);
    				stats = getUser.main;
    				stats[0] = parseInt(stats[0]) - attackdmg[0];
    				getUser.main = stats;
                    getUser = updatePlayer(getUser, self, id);
                    trigger = false
                }
    			}, 60000, this.roomClient, senderId, getUser, this);
        }
    }
    increaseMonsterChance[senderName] = 1;
    trigger = false

	return;
});

addon.webhook('room_message', /^\/stats\s*([\S]*)$/i, function  * () {
	if (stats_process)
		return;
	stats_process = true;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var allUsers = yield this.tenantStore.all(10000);
    if (isBossFight){
        allUsers = bossMonsterParty.store;
    }
    
    if (matchString[1] == "all"){

        if (statsAll) {
            stats_process = false;
            return yield printMessage("It's too soon for stats all.", "red", this.roomClient, "text");
        }
    
        statsAll = true;
        var printString = "";
        for (var i in allUsers){
  
      
            var personName = i;
            if (i.length < 4) continue;
            var tempPlayerArray = yield this.tenantStore.get(personName);
            var tempPlayerStats = tempPlayerArray.main;
            var tempPlayerClass = tempPlayerArray.classInfo
            var tempPlayerProfile = tempPlayerArray.profile
            var nameToUse = getNameToUse(tempPlayerProfile);
            printString += "<b>" + nameToUse + "</b> stats | " 
                + tempPlayerClass[0] + " | <b>hp:</b> " 
                + tempPlayerStats[0].toString() + " | <b>Level:</b> " 
                + tempPlayerStats[4] + " | <b>EXP:</b> " + tempPlayerStats[3] 
                + " | <b>pepper:</b> " + tempPlayerStats[1].toString()
                + " | <b>gold:</b> " + tempPlayerStats[5].toString() + "<br>";


        }
        yield printMessage(printString, "yellow", this.roomClient, "html");
            statsTimer = setTimeout(function (room) {
                logToFile("stats all is ready");
                stats_process = false;
                statsAll = false;
            }, 60000, this.roomClient);
        stats_process = false;
        return;
    }else if (matchString[1] == "top"){ 
       if (statsAll) {
            stats_process = false;
            return yield printMessage("It's too soon for stats all.", "red", this.roomClient, "text");
        }
        var expArray = {};
        var finalExpArray = {};
        var finalPepperArray = {};
        var finalGoldArray = {};
        // reset exp array to exp
        for (var i in allUsers){
            expArray[allUsers[i].profile[0]] = allUsers[i].main[3];
        }
        // top 3 exps
        for (var numOfTimes = 0; numOfTimes<3; numOfTimes++){

            var max = Math.max.apply(null,
                            Object.keys(expArray).map(function(e) {
                                    return expArray[e];
                                    }));
            for (var name in expArray){
                if (expArray[name] == max){
                    finalExpArray[name] = expArray[name];
                    delete expArray[name]
                    break;
                }
            }

        }
        // reset expArray to peppers
        expArray = {};
        for (var i in allUsers){
            expArray[allUsers[i].profile[0]] = allUsers[i].main[1];
        }
        for (var numOfTimes = 0; numOfTimes<3; numOfTimes++){

            var max = Math.max.apply(null,
                            Object.keys(expArray).map(function(e) {
                                    return expArray[e];
                                    }));
            for (var name in expArray){
                if (expArray[name] == max){
                    finalPepperArray[name] = expArray[name];
                    delete expArray[name]
                    break;
                }
            }

        }
        // reset expArray to gold
        expArray = {};
        for (var i in allUsers){
            expArray[allUsers[i].profile[0]] = allUsers[i].main[5];
        }
        for (var numOfTimes = 0; numOfTimes<3; numOfTimes++){

            var max = Math.max.apply(null,
                            Object.keys(expArray).map(function(e) {
                                    return expArray[e];
                                    }));
            for (var name in expArray){
                if (expArray[name] == max){
                    finalGoldArray[name] = expArray[name];
                    delete expArray[name]
                    break;
                }
            }

        }
        // print messages
        var messageToSend = "";
        messageToSend += "################## The Newbies Leaderboard ##################\n";
        messageToSend += "~~~~~ Current Top 3 EXP ~~~~~\n";
        yield printMessage(messageToSend, "purple", this.roomClient, "text");
        var expMessage = "";

        for (var i in finalExpArray){
            expMessage += "[ " + i + " ] ~~~~~ " + finalExpArray[i] + "\n";
        }

        yield printMessage(expMessage, "gray", this.roomClient, "text");
        yield printMessage("~~~~~ Current Top 3 Peppers ~~~~~", "purple", this.roomClient, "text");

        var pepMessage = "";
        for (var i in finalPepperArray){
            pepMessage += "[ " + i + " ] ~~~~~ " + finalPepperArray[i] + "\n";
        }
        yield printMessage(pepMessage, "gray", this.roomClient, "text");
        yield printMessage("~~~~~ Current Top 3 Gold ~~~~~", "purple", this.roomClient, "text");

        var goldMessage = "";
        for (var i in finalGoldArray){
            goldMessage += "[ " + i + " ] ~~~~~ " + finalGoldArray[i] + "\n";
        }
        yield printMessage(goldMessage, "gray", this.roomClient, "text");



        statsTimer = setTimeout(function (room) {
                logToFile("stats all is ready");
                stats_process = false;
                statsAll = false;
            }, 60000, this.roomClient);

        stats_process = false;
        return
     }else if (matchString[1] == "alltime"){
       if (statsAll) {
            stats_process = false;
            return yield printMessage("It's too soon for stats all.", "red", this.roomClient, "text");
        }
        var expArray = {};
        var finalExpArray = {};
        var finalPepperArray = {};
        var finalGoldArray = {};
        // TODO: load the all time stats from file

        var fs = require('fs');
        var obj = fs.readFileSync('alltime.json', 'utf8')
        logToFile(obj.toString())
        if (obj.toString() != ""){
            topScoresAll = JSON.parse(obj);
            logToFile(topScoresAll.toString());
        }

        // reset exp array to exp
        for (var i in allUsers){
            expArray[allUsers[i].profile[0]] = allUsers[i].main[3];
        }
        // top 3 exps
        for (var numOfTimes = 0; numOfTimes<3; numOfTimes++){

            var max = Math.max.apply(null,
                            Object.keys(expArray).map(function(e) {
                                    return expArray[e];
                                    }));
            for (var name in expArray){
                if (expArray[name] == max){
                    finalExpArray[name] = expArray[name];
                    delete expArray[name]
                    break;
                }
            }

        }
        // reset expArray to peppers
        expArray = {};
        for (var i in allUsers){
            expArray[allUsers[i].profile[0]] = allUsers[i].main[1];
        }
        for (var numOfTimes = 0; numOfTimes<3; numOfTimes++){

            var max = Math.max.apply(null,
                            Object.keys(expArray).map(function(e) {
                                    return expArray[e];
                                    }));
            for (var name in expArray){
                if (expArray[name] == max){
                    finalPepperArray[name] = expArray[name];
                    delete expArray[name]
                    break;
                }
            }

        }
        // reset expArray to gold
        expArray = {};
        for (var i in allUsers){
            expArray[allUsers[i].profile[0]] = allUsers[i].main[5];
        }
        for (var numOfTimes = 0; numOfTimes<3; numOfTimes++){

            var max = Math.max.apply(null,
                            Object.keys(expArray).map(function(e) {
                                    return expArray[e];
                                    }));
            for (var name in expArray){
                if (expArray[name] == max){
                    finalGoldArray[name] = expArray[name];
                    delete expArray[name]
                    break;
                }
            }

        }
        /**
        var topScoresAll = {
            expPlayers = ["","",""],
            expScores = [0,0,0],
            goldPlayers = ["","",""],
            goldScores = [0,0,0],
            pepperPlayers = ["","",""],
            pepperScores =[0,0,0]
        }
        **/
        // calc if the current top 3 is higher than the alltime 3;       
        //exp, requires at least 3 in array
        for (var i in finalExpArray){
            // #1
            if (finalExpArray[i] > topScoresAll.expScores[0]){
                topScoresAll.expPlayers[0] = i;
                topScoresAll.expScores[0] = finalExpArray[i];
                continue;

            }else if(finalExpArray[i] > topScoresAll.expScores[1] && !isInArray(i, topScoresAll.expPlayers)){
            // #2
                topScoresAll.expPlayers[1] = i;
                topScoresAll.expScores[1] = finalExpArray[i];
                continue;
                
            }else if(finalExpArray[i] > topScoresAll.expScores[2] && !isInArray(i, topScoresAll.expPlayers)){
            // #3
                topScoresAll.expPlayers[2] = i;
                topScoresAll.expScores[2] = finalExpArray[i];
                continue;
            }

        }

        //peppers
        for (var i in finalPepperArray){
            // #1
            if (finalPepperArray[i] > topScoresAll.pepperScores[0]){
                topScoresAll.pepperPlayers[0] = i;
                topScoresAll.pepperScores[0] = finalPepperArray[i];
                continue;


            }else if(finalPepperArray[i] > topScoresAll.pepperScores[1] && !isInArray(i, topScoresAll.pepperPlayers)){
            // #2
                topScoresAll.pepperPlayers[1] = i;
                topScoresAll.pepperScores[1] = finalPepperArray[i];
                continue;
                
            }else if(finalPepperArray[i] > topScoresAll.pepperScores[2]  && !isInArray(i, topScoresAll.pepperPlayers)){
            // #3
                topScoresAll.pepperPlayers[2] = i;
                topScoresAll.pepperScores[2] = finalPepperArray[i];
                continue;
            }

        }

        // gold 
        for (var i in finalGoldArray){
            // #1
            if (finalGoldArray[i] > topScoresAll.goldScores[0]){
                topScoresAll.goldPlayers[0] = i;
                topScoresAll.goldScores[0] = finalGoldArray[i];
                continue;

            }else if(finalGoldArray[i] > topScoresAll.goldScores[1]  && !isInArray(i, topScoresAll.goldPlayers)){
            // #2
                topScoresAll.goldPlayers[1] = i;
                topScoresAll.goldScores[1] = finalGoldArray[i];
                continue;
                
            }else if(finalGoldArray[i] > topScoresAll.goldScores[2] && !isInArray(i, topScoresAll.goldPlayers)){
            // #3
                topScoresAll.goldPlayers[2] = i;
                topScoresAll.goldScores[2] = finalGoldArray[i];
                continue;
            }

        }

        // save to file


        // print messages
        logToFile(JSON.stringify(topScoresAll));
        var messageToSend = "";
        messageToSend += "################## The Newbies Leaderboard ##################\n";
        messageToSend += "~~~~~ Top EXP ~~~~~\n";
        yield printMessage(messageToSend, "purple", this.roomClient, "text");
        var expMessage = "";
        expMessage += "[ " + topScoresAll.expPlayers[0] + " ] ~~~~~ " + topScoresAll.expScores[0] + "\n";
  

        yield printMessage(expMessage, "gray", this.roomClient, "text");
        yield printMessage("~~~~~ Top Pepper ~~~~~", "purple", this.roomClient, "text");

        var pepMessage = "";
        pepMessage += "[ " + topScoresAll.pepperPlayers[0] + " ] ~~~~~ " + topScoresAll.pepperScores[0] + "\n";
        yield printMessage(pepMessage, "gray", this.roomClient, "text");
        yield printMessage("~~~~~ Top Gold ~~~~~", "purple", this.roomClient, "text");

        var goldMessage = "";
        goldMessage += "[ " + topScoresAll.goldPlayers[0] + " ] ~~~~~ " + topScoresAll.goldScores[0] + "\n";
        
        yield printMessage(goldMessage, "gray", this.roomClient, "text");

        var fs = require('fs');
        fs.writeFileSync("alltime.json", JSON.stringify(topScoresAll), 'utf8');


        statsTimer = setTimeout(function (room) {
                logToFile("stats all is ready");
                stats_process = false;
                statsAll = false;

            }, 60000, this.roomClient);

        stats_process = false;
        return
    }

    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);

	stats = getUser.main;
	pclass = getUser.classInfo;
    profile = getUser.profile;

    if (senderName == "Josh Elsasser"){
        var tableString = "<table><tr><th>"+senderMentionName + ":</th><th>Hunker</th><th>Hunker</th><th>Hunker</th><th>Hunker</th><th>Hunker</th><th>Hunker</th><th>Hunker</th></tr>" +
            "<tr><td>" +profile[1] +"</td><td>" +pclass[0]+"</td><td>"+stats[0].toString()+"</td><td>"+stats[4]+"</td><td>"+stats[3]+"</td><td>"+stats[1]+"</td><td>"+stats[2].toString()+"(+" +pclass[3].toString()+")</td><td>"+stats[5].toString()+"</td></tr></table>";

        yield printMessage(tableString, "green", this.roomClient, "html");

    }else{
        var tableString = "<table><tr><th>"+senderMentionName + ":</th><th>Class</th><th>HP</th><th>Level</th><th>EXP</th><th>Pepper</th><th>Seasoning</th><th>Gold</th></tr>" +
            "<tr><td>" +profile[1] +"</td><td>" +pclass[0]+"</td><td>"+stats[0].toString()+"</td><td>"+stats[4]+"</td><td>"+stats[3]+"</td><td>"+stats[1]+"</td><td>"+stats[2].toString()+"(+" +pclass[3].toString()+")</td><td>"+stats[5].toString()+"</td></tr></table>";

        yield printMessage(tableString, "green", this.roomClient, "html");
    }
    //printMessage(tableString, "green", this.roomClient, "html");
    stats_process = false;
// 	yield this.roomClient.sendNotification("@" + this.sender.mention_name + "'s stats | class: " + pclass[0] + " | hp: " + stats[0].toString() + " | Level: " + stats[4] + " | EXP: " + stats[3] + " | pepper: " + stats[1].toString() + " | seasoning modifier: " + stats[2].toString(), {
// 	//	color : 'green',
// 	//	format : 'text'
// 	//});
});

addon.webhook('room_message', /^\/inventory/i, function  * () {
	if (inventory_process)
		return;
    inventory_process = true;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);

	inventory = getUser.inventory;
	yield this.roomClient.sendNotification(senderName + "'s inventory: " + inventory.toString());
	inventory_process = false;
});

addon.webhook('room_message', /^\/pepper\s*([0-9]+)?/i, function  * () {
	if (prayer_process) {
		return;
	}

	prayer_process = true;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    getUser = initPlayer(getUser, this, senderId, senderName);

	stats = getUser.main;
    var nickName = getNameToUse(getUser.profile);
    var amountOfPepperToUse = 1;
    if (matchString[1]){
        amountOfPepperToUse = parseInt(escape(matchString[1]));
    }
    if (isNaN(amountOfPepperToUse)) amountOfPepperToUse = 1;
	if (amountOfPepperToUse > stats[1]) {
        if (senderName == "Josh Elsasser"){
            yield this.roomClient.sendNotification(nickName + " does not have enough hunkering to hunker.");

        }else{
    		yield this.roomClient.sendNotification(nickName + " does not have enough pepper to season.");
        }
	} else {
		var prayermod = rollDice(amountOfPepperToUse, 5, 0)[0]
		stats[1] = stats[1] - amountOfPepperToUse;
		stats[2] = parseInt(stats[2] + prayermod);
        getUser.main = stats;
        updatePlayer(getUser, this, senderId);
        if (senderName == "Josh Elsasser"){
            yield this.roomClient.sendNotification("The pan hunkerzles as " + nickName + " hunkers in " + prayermod.toString() + " hunkering.");

        }else{
            yield this.roomClient.sendNotification("The pan sizzles as " + nickName + " adds in " + prayermod.toString() + " seasoning.");
        }
	}

	prayer_process = false;

});

addon.webhook('room_message', /^\/roll\s*([0-9]+)?(?:d([0-9]+))?(?:\s*\+\s*([0-9]+))?/i, function  * () {
    if (alreadyrolling)
        return;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderId = this.sender.id;
    var store = yield this.tenantStore.all(10000);
    var getUser = yield this.tenantStore.get(senderId)
    logToFile("In /roll initplayer)");
    getUser = initPlayer(getUser, this, senderId, senderName);
    var senderMentionName = getNameToUse(getUser.profile);
	alreadyrolling = true;;
	var numofvars = matchString;
	var numofdice = matchString[1];
	var numofsides = matchString[2];
	var modifier = matchString[3];
    if (isBossFight){
        store = bossMonsterParty.store;
    }
	if (parseInt(matchString[1]) > 100) {
		alreadyrolling = false;
        return yield printMessage("@" + senderMentionName + " sucks at foosball", "yellow", this.roomClient, "text")
	}
	if (matchString[1] && matchString[2] && matchString[3]) {
        var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(modifier));
        logToFile("Mod dice roll" + diceRoll);
		var totalString = formatRoll(parseInt(numofdice),parseInt(numofsides),parseInt(modifier),diceRoll, senderMentionName);
		var total = diceRoll[0]
        yield printMessage(totalString, "purple", this.roomClient, "text");


	} else if (matchString[1] && matchString[2] || !matchString[1] && !matchString[2] && !matchString[3]) {
		var totalString = "";
		var total = 0;
        logToFile("duel roll? " +(senderName == duelObj.playerOne || senderName == duelObj.playerTwo ))
         logToFile("duel roll? " + duelObj.attackingphase)
        if (duelObj.attackingphase && (senderName == duelObj.playerOne || senderName == duelObj.playerTwo)){
            if ((senderName == duelObj.playerOne) && duelObj.playerOneRoll != 0 || (senderName == duelObj.playerTwo) && duelObj.playerTwoRoll != 0){
                alreadyrolling = false;
              return;  
            }
            seasonMod = 0;
            numofdice = 1;
            numofsides = 20;
            var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(seasonMod));
            totalString = formatRoll(numofdice, numofsides, seasonMod, diceRoll, senderName)
            total = parseInt(diceRoll[0]);
            yield printMessage("Dueling roll: " + totalString, "purple", this.roomClient, "text");
            if (duelObj.playerOne == senderName){
                duelObj.playerOneRoll = total;
            }else{
                duelObj.playerTwoRoll = total;
            }
            alreadyrolling = false;
            return;
        }

        if (isBossFight && (!matchString[1] && !matchString[2] && !matchString[3])){

            if ((isInArray(senderId, bossMonsterParty.playersIn))){
                alreadyrolling = false;
                return;
            }
            if (senderId == bossMonsterParty.target || isInArray(bossMonsterParty.target, bossMonsterParty.playersIn)){


            logToFile("GainHP in roll boss: " + gainHP.toString());
            classCast(senderName, this.roomClient, getUser, senderId, this, store);
            getUser = initPlayer(getUser, this, senderId, senderName);
            var seasonMod = getUser.main[2];
            getUser.main[2] = 0;
            numofdice = 1;
            numofsides = 20;
            var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(seasonMod));
            totalString = formatRoll(numofdice, numofsides, seasonMod, diceRoll, senderMentionName)
            total = parseInt(diceRoll[0]);
            yield printMessage(totalString, "purple", this.roomClient, "text");
            bossMonsterParty.playersIn.push(senderId);
            bossMonsterParty.playerNames.push(senderName);
            bossMonsterParty.playersRoll.push(total);
            bossMonsterParty.totalRoll += total;
            var leftOver = bossMonsterParty.hp - bossMonsterParty.totalRoll;
            updatePlayer(getUser, this, senderId);
            if (leftOver <=0){
                clearTimeout(monsterBossTimer);
                monsterBossMethod();
            }else {
            if (senderName == "Josh Elsasser"){
                yield printMessage(senderName + " hunkers " + total.toString() + " to the hunkered boss roll. Boss has " + leftOver.toString() + " hunker left!", "yellow", this.roomClient, "text");

            }else{
                yield printMessage(senderName + " added " + total.toString() + " to the monster boss roll. Boss has " + leftOver.toString() + " hp left!", "yellow", this.roomClient, "text");
            }
                
            }
            alreadyrolling = false;
            return;
        }else{
            alreadyrolling = false;
            return;
        }


        }else if (!matchString[1] && !matchString[2] && !matchString[3]) {
            if ((underattack == senderName)){
                classCast(senderName, this.roomClient, getUser, senderId, this, store);
                getUser = yield this.tenantStore.get(senderId)
            }
			var seasonMod = getUser.main[2];
            var inventory = getUser.inventory;
            var itemMod = 0;
            if (isInArray("Shiny spatula", inventory) && senderName == underattack){
                itemMod = Math.ceil(seasonMod * .20);
                seasonMod += itemMod;
                //yield printMessage(senderMentionName + " increases the seasoning mod to " + seasonMod.toString() + " from " + (seasonMod -itemMod).toString(), "purple", this.roomClient, "text");
            }
			numofdice = 1;
			numofsides = 20;
            var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(seasonMod));
			totalString = formatRoll(numofdice, numofsides, seasonMod, diceRoll, senderMentionName)
			total = parseInt(diceRoll[0]);
	
		}else {

			numofdice = parseInt(matchString[1]);
			numofsides = parseInt(matchString[2]);
			logToFile("NUMOFDICE: " + numofdice);
			var diceResult = rollDice(numofdice,numofsides,0);
			totalString = formatRoll(numofdice, numofsides, 0 , diceResult, senderMentionName)
			total = diceResult[0];

		}
        if (senderName == "Josh Elsasser"){
        yield printMessage(totalString.replace("rolled", "hunkered"), "purple", this.roomClient, "text");

        }else{
        yield printMessage(totalString, "purple", this.roomClient, "text");
        }


		if (((senderName == underattack) && (numofdice == 1) && (numofsides == 20 ))) {
			clearTimeout(monsterTimer);
            underattack == "";
            monsterGracePeriodTmr = setTimeout(monsterGracePeriod, 30000);
			logToFile("TOTAL ROLL: " + total);
            logToFile("HP TO BEAT: " + hp);
			if (parseInt(total) >= hp) {
				if (total == 20){
                    amountofExp = amountofExp * 2;
                    monsterGoldDrop = monsterGoldDrop * 2;
                }
                var nameToUse = getNameToUse(getUser.profile);
                logToFile("GainHP in roll: " + gainHP.toString());
                if (senderName == "Josh Elsasser"){
                yield this.roomClient.sendNotification('<b>' + nameToUse + '</b> hunkered the ' + monsterType + ' and hunkered up ' + monsterfoodDrop + ' that hunkers ' + Math.floor(gainHP) + " hp along with " + amountofExp + " hunkerExp and " + monsterGoldDrop.toString() + " hunker!", {
                    color : 'purple',
                    format : 'html'
                });
                }else{
                yield this.roomClient.sendNotification('<b>' + nameToUse + '</b> fried the ' + monsterType + ' and cooked up ' + monsterfoodDrop + ' that restores ' + Math.floor(gainHP) + " hp along with " + amountofExp + " exp and " + monsterGoldDrop.toString() + " gold!", {
                    color : 'purple',
                    format : 'html'
                });                
                }

				stats = getUser.main;
				stats[3] = stats[3] + amountofExp;
                stats[5] = parseInt(stats[5]) + parseInt(monsterGoldDrop);
                goldTopScore(senderName, stats[5], this.roomClient);
                var currentLevel = stats[4];
				stats[4] = Math.floor(stats[3] / 20);
                stats[4] = calcLevel(stats[3])
                if (currentLevel < stats[4]){
                    yield printMessage("@" + senderMentionName + " has leveled up and is now level " + stats[4].toString() + ". +50hp.", "yellow", this.roomClient, "text");
					stats[0] += 50;
                }
				amountofExp = 0;
                monsterGoldDrop = 0;
				stats[2] = 0;

				stats[0] = parseInt(stats[0]) + Math.floor(gainHP);
				if (chanceOfFaith) {
					chanceOfFaith = false;
					yield this.roomClient.sendNotification('The monster dropped some pepper! @' + senderMentionName + ' gained 1 pepper.', {
						color : 'purple',
						format : 'text'
					});
					stats[1] = stats[1] + 1;
                    pepperTopScore(senderName, stats[1], this.roomClient);
				}

                // item gain
                var getItem = randFromRange(1,10);
                logToFile("getItem value: " + getItem.toString());
                if (getItem == 1){
                    var itemIndex = Math.floor(Math.random() * rareItems.length)
                    var itemToGet = rareItems[itemIndex];
                    var itemDescrip = rareItemsEffects[itemIndex];
                    if (!isInArray(itemToGet, getUser.inventory)){
                        var message = "@" + senderMentionName + " picked up a " + itemToGet +"! Effect: " + itemDescrip
                        yield printMessage(message, "gray", this.roomClient, "text");
                        getUser.inventory.push(itemToGet);
                    }
                }
				getUser.main = stats;
                getUser = updatePlayer(getUser,this, senderId);
                trigger = false;
                underattack = "";
			} else {
                if (isInArray("Chef's Apron", getUser.inventory)){
                    attackdmg[0] -= (Math.floor(attackdmg[0]*.10));
                    yield printMessage("@" + senderMentionName + " decreased the attack damage of the monster to " + attackdmg[0].toString(), "gray", this.roomClient, "text");
                }
                logToFile("losing hp: " + attackdmg.toString());
				yield this.roomClient.sendNotification("@" + senderMentionName + ' lost ' + attackdmg[0] + ' hp!', {
					color : 'purple',
					format : 'text'
				});
				stats = getUser.main;
				stats[2] = 0;
				stats[0] = parseInt(stats[0]) - parseInt(attackdmg[0]);
                // reset class stacks
                getUser.classInfo[3] = 0;
                logToFile("Current hp after loss: " + stats[0]);
				if (parseInt(stats[0]) <= 0){
                    logToFile("Dead player");
					yield this.roomClient.sendNotification("@" + senderMentionName + ' has died.', {
					   color : 'red',
					   format : 'text'
					});
					delPlayer(this, senderId);
				}else{
					getUser.main = stats;
                    getUser = updatePlayer(getUser, this, senderId);
				}
				underattack = ""
                trigger = false;
			}



		}
	} else if (matchString[1]) {

		yield this.roomClient.sendNotification("@" + senderMentionName + ' rolled a dice with ' + matchString[1] + ' sides ...... [' + (Math.floor(Math.random() * parseInt(matchString[1])) + 1) + ']', {
			color : 'purple',
			format : 'text'
		});

	}
	alreadyrolling = "";
});

function getAllPeople(people){
    var LineByLineReader = require('line-by-line'),
        lr = new LineByLineReader('people.txt');

    lr.on('error', function (err) {
        // 'err' contains error object
    });

    lr.on('line', function (line) {
        increaseMonsterChance[line] = 1;
    });

    lr.on('end', function () {
        // All lines are read, file is closed now.
    });
}
function fillMonsterChanceArray(){
    var LineByLineReader = require('line-by-line'),
        lr = new LineByLineReader('peopleTag.txt');

    lr.on('error', function (err) {
        // 'err' contains error object
    });

    lr.on('line', function (line) {
        gMonsterChance.push(line);
    });

    lr.on('end', function () {
        // All lines are read, file is closed now.
    });
}


// DICE ROLLING FUNCTIONS
// ======================

// USAGE: Print this string with "@UserX: " appended to the front.
function formatRoll (num, sides, mod, res, playername) {
	var pre_str = playername + " rolled " + num.toString() + "d" + sides.toString() + "+" + mod.toString() + ": ";

	var res_str = "(";
	for (var i = 1; i < num+1; i++) {
		if (i == 1) {
			res_str += res[i];
		} else {
			res_str += "+" + res[i];
		}
	}
	res_str += ")";
	if (mod) {
		res_str += "+" + mod;
	}
	res_str += " = " + res[0];

	return pre_str + res_str;
}

function rollDice (num, sides, mod) {
	var res = [];
	res.push(0);

	// default values
	if (!num) {
		num = 1;
	}
	if (!sides) {
		sides = 20;
	}
	if (!mod) {
		mod = 0;
	}

	//sanity check
	// if (parseInt(num) > 100) {
	// 	res[0] = -1;
	// 	return res;
	// }

	for (i = 1; i < num + 1; i++) {
		res.push(randFromRange(1, sides));
		res[0] += res[i];
	}
    res[0] = parseInt(res[0]) + parseInt(mod);
	return res;
}

function randFromRange (low, high) {

    var roll = Math.floor(Math.random()*(parseInt(high)-parseInt(low)+1)+parseInt(low));

    return roll;
}

// HIPCHAT FUNCTIONS
// =================

function printMessage (msg, clr, room, form) {
    if (form == "undefined") form = "html";
	return room.sendNotification(
		msg,
		{
			color : clr,
			format : form
		});

}

// PAT'S RANDOM, UNSORTED FUNCTIONS
// ================================

function sleep (milliSeconds) {
	var startTime = new Date().getTime(); // get the current time
	while (new Date().getTime() < startTime + milliSeconds); // hog cpu
}

// data v2: [main: [ hp, pepperpoints, mod, exp, lvl ,gold]
//           inventory: [items]
//           classInfo: [name, rerolls, target, classMod] 
//           profile: [playerName, "", "","","",""]
//           ]
function initPlayer(playername, self, id, name) {
    var self = self;
    if (playername){
    logToFile("USER DOES EXIST: " + playername.profile[0])
    if (isBossFight){
        return bossMonsterParty.store[id];
    }
    if (duelObj.status){
        return duelObj.store[id];
    }
    return playername;
    }
    logToFile("CREATING USER: " + id);
    var playerObject = {
        main: [100,1,0,0,0,0,0],
        inventory: [],
        classInfo: ["",1,"",0,"",""],
        profile: [name, "", "","","",""]

    }
    updatePlayer(playerObject, self, id);

    return playerObject;
}
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
function updatePlayer(playerObject, self, id){
    if (isBossFight){
        logToFile("Saving to bossStore");
        bossMonsterParty.store[id] = playerObject;
        return;
    }
    var self = self;
    logToFile("Updating db: " + playerObject.toString())
    self.tenantStore.set(id, playerObject);
    logToFile("Saved PlayerObject for: " + id);
    return playerObject;
}
function delPlayer(self, id){
    var self = self;
    self.tenantStore.del(id);
    if (isBossFight){
        delete bossMonsterParty.store[id];
    }
    return logToFile("Deleted PlayerObject for: " + id);
}
function getIdFromName(self, name, store){
    var allUsers = store;
    for (var i in allUsers){
        logToFile("Getting name from " + allUsers[i].profile);
        var profile = allUsers[i].profile;
        if (profile[0] == name){
            return i;
        }

    }
    return -1
}

function calcLevel(currentExp){
    // LEVEL SCALING
    var level = Math.floor(Math.pow((parseInt(currentExp) / 20),(1/1.75)));
    logToFile("New Level of player: " + level.toString());
    return level;
}
function getNameToUse(playerProfileArray){

    var fullName = playerProfileArray[0].split(" ");
    if (playerProfileArray[1] == ""){
        return playerProfileArray[0];
    }else{
        return playerProfileArray[1].toString() + " (" + fullName[0].charAt(0) + "." + fullName[1].charAt(0) + ")";
    }
}
function pepperTopScore(senderName, peppers, room){
    var fs = require('fs');
    var obj = fs.readFileSync('alltime.json', 'utf8')
    logToFile(obj.toString())
    if (obj.toString() != ""){
        topScoresAll = JSON.parse(obj);
        logToFile(topScoresAll.toString());
    }
    logToFile("Does he top the peppers? " + (peppers>topScoresAll.pepperScores[0]).toString());
    if (peppers > topScoresAll.pepperScores[0]){
        topScoresAll.pepperScores[0] = peppers;
        topScoresAll.pepperPlayers[0] = senderName;

        var fs = require('fs');
        fs.writeFileSync("alltime.json", JSON.stringify(topScoresAll), 'utf8');
        printMessage(senderName + " has just achieved a new pepper high score!", "green", room, "text");
        return; 
    } else if (peppers > topScoresAll.pepperScores[1] && !isInArray(senderName, topScoresAll.pepperPlayers)){
        topScoresAll.pepperScores[1] = peppers;
        topScoresAll.pepperPlayers[1] = senderName;

        var fs = require('fs');
        fs.writeFileSync("alltime.json", JSON.stringify(topScoresAll), 'utf8');

        return; 
    } else if (peppers > topScoresAll.pepperScores[2] && !isInArray(senderName, topScoresAll.pepperPlayers)){
        topScoresAll.pepperScores[2] = peppers;
        topScoresAll.pepperPlayers[2] = senderName;

        var fs = require('fs');
        fs.writeFileSync("alltime.json", JSON.stringify(topScoresAll), 'utf8');

        return; 
    }

}
function goldTopScore(senderName, gold, room){
    var fs = require('fs');
    var obj = fs.readFileSync('alltime.json', 'utf8')
    logToFile(obj.toString())
    if (obj.toString() != ""){
        topScoresAll = JSON.parse(obj);
        logToFile(topScoresAll.toString());
    }
    logToFile("Does he top the gold? " + (gold>topScoresAll.goldScores[0]).toString());
    if (gold > topScoresAll.goldScores[0]){
        topScoresAll.goldScores[0] = gold;
        topScoresAll.goldPlayers[0] = senderName;

        var fs = require('fs');
        fs.writeFileSync("alltime.json", JSON.stringify(topScoresAll), 'utf8');
        printMessage(senderName + " has just achieved a new gold high score!", "green", room, "text");
        return; 
    } else if (gold > topScoresAll.goldScores[1] && !isInArray(senderName, topScoresAll.goldPlayers)){
        topScoresAll.goldScores[1] = gold;
        topScoresAll.goldPlayers[1] = senderName;

        var fs = require('fs');
        fs.writeFileSync("alltime.json", JSON.stringify(topScoresAll), 'utf8');

        return; 
    } else if (gold > topScoresAll.goldScores[2] && !isInArray(senderName, topScoresAll.goldPlayers)){
        topScoresAll.goldScores[2] = gold;
        topScoresAll.goldPlayers[2] = senderName;

        var fs = require('fs');
        fs.writeFileSync("alltime.json", JSON.stringify(topScoresAll), 'utf8');

        return; 
    }

}
function duelObject(store){
    this.status = false,
    this.waitingForAccept = false,
    this.playerOne = "",
    this.playerOneRoll = 0,
    this.playerOneBetters = [],
    this.playerOneBettersBets = [],
    this.playerOneTotalBets = 0,
    this.playerTwo = "",
    this.playerTwoRoll = 0,
    this.playerTwoBetters = [],
    this.playerTwoBettersBets = [],
    this.playerTwoTotalBets = 0,
    this.bettingPhase = false,
    this.attackingphase = false,
    this.duelBetTimer = 0,
    this.duelRollTimer = 0,
    this.duelAcceptTimer = 0,
    this.store = store
}
function classCast(playername, roomClient, playerObject, id, self, glbStore){

    logToFile("GainHP in classCast: " + gainHP.toString());
    var store = glbStore;
    if (isBossFight){
        store = bossMonsterParty.store;
    }
    var self = self;
    var senderId = id;
    var abilityCheck = randFromRange(1,2);
    logToFile("STORE: " + store.toString());
    logToFile("Ability Check: " + abilityCheck.toString());
    var getUser = playerObject;
    var playerClass = getUser.classInfo;
    var nickName = getNameToUse(getUser.profile);
    // 1 ability for now
    if (true){
        var chooseAbility = randFromRange(1,2);
        logToFile("Ability to use: " + chooseAbility.toString());
        switch (playerClass[0]){
            case "Cleric":
                if (chooseAbility == 1){
                    var healPower = Math.floor(parseInt(rollDice(parseInt(getUser.main[4]),5,0)[0]));
                    var target = playerClass[2];
                    if (target == ""){
                        target = playername;
                        printMessage(nickName + " casted <b>Self Renew</b> and was healed for <b>" + healPower.toString() + "</b>!", "random", roomClient, "html");
                    }else {
                        printMessage(nickName + " casted <b>Self Renew</b> on " + target + " and healed for <b>" + healPower.toString() + "</b>!", "random", roomClient, "html");
                    }
                    var targetId = getIdFromName(self, target, store);
                    logToFile("GOT ID: " + targetId);
                    var targetMainArray = store[targetId];
                    logToFile("targerray: " + targetMainArray.toString());

                    var targetStats = targetMainArray.main;
                    targetStats[0] = parseInt(targetStats[0]) + healPower;
                    logToFile("targetStats after heal: " + targetStats.toString())
                    targetMainArray.main = targetStats;
                    updatePlayer(targetMainArray, self, targetId)
                } else if (chooseAbility == 2 && !isBossFight){
                    var atkRoll = Math.ceil(randFromRange(getUser.main[4]/2, getUser.main[4]));
                    printMessage(nickName + " casted <b>antithesis</b> and lowered the hp of the mob by <b>" + atkRoll.toString() + "</b>.", "random", roomClient, "html");
                    logToFile("HP before antithesis: " + hp.toString());
                    hp -= atkRoll;
                }
                break;

            case "Mage":
                if (chooseAbility == 1){
                    var magicPower = randFromRange(Math.ceil(getUser.main[4]/2), getUser.main[4]*2);
                    printMessage(nickName + " peppered <b>magic missiles</b> and added <b>" + magicPower.toString() + "</b> to seasoning modifier.", "random", roomClient, "html");
                    var stats = getUser.main;
                    stats[2] = parseInt(stats[2]) + parseInt(magicPower);
                    logToFile("Magic Missiles added: " + stats.toString());
                    getUser.main = stats;
                    updatePlayer(getUser, self, senderId);
                }else if (chooseAbility == 2 && !isBossFight){
                    var magicHPreduce = randFromRange(1,getUser.main[4])
                    hp = hp - magicHPreduce;
                    printMessage(nickName + " covered the monster in <b>Soy Sauce</b> and reduced the hp by <b>" + magicHPreduce.toString() + "</b>. HP of mob is now " + hp.toString(), "random", roomClient, "html");
                }
                break;
            case "Princess":
                if (chooseAbility ==1){
                    var princessPower = randFromRange(1, parseInt(getUser.main[4])/2);
                    printMessage(nickName + " waves around the magical <b>cinnamon stick</b> and produced <b>" + princessPower.toString() + " peppers </b>.", "random", roomClient, "html");
                    getUser.main[1] += princessPower;

                    pepperTopScore(getUser.profile[0], getUser.main[1], roomClient);
                    updatePlayer(getUser, self, senderId)
                }else if(chooseAbility==2){
                    logToFile("bread stick attackdmg: " + attackdmg[0]);
                    var reduceAttackDmg = randFromRange(0, attackdmg[0]);
                    printMessage(nickName + " waves around the glowing <b>bread stick</b> and reduced the attack damage of the monster by <b>" +reduceAttackDmg.toString() + "</b>.", "random", roomClient, "html");
                    attackdmg[0] -= reduceAttackDmg;
                }
                break;
            case "Warrior":
                var attackModi = randFromRange(1, getUser.main[4]);
                var wrongMove = randFromRange(1,5);
                if (playerClass[3] == "") playerClass[3] = 0;

                if (wrongMove == 3) {
                    var oriHp = getUser.main[0];
                    var lostMod = (playerClass[3]/100);
                    if (lostMod >= 1){
                        lostMod = .99;
                    }
                    var lostHp = Math.ceil(oriHp * lostMod);
                    getUser.classInfo[3] = 0;
                    if (lostHp >= getUser.main[0]){
                        lostHp = getUser.main[0] - 1;
                    }
                    getUser.main[0] -= lostHp;
                    updatePlayer(getUser, self, senderId);
                    printMessage(nickName + " accidentally slips in the butter and loses " + lostHp.toString() +" hp.", "random", roomClient, "html");
                }
                if (chooseAbility == 1) {
                    getUser.classInfo[3] += attackModi;                    
                    printMessage(nickName + " executes <b>Pancakes From Above</b> and added <b>"+attackModi.toString()+"</b> to the seasoning modifier.", "random", roomClient, "html");
                    attackdmg[0] = (attackdmg[0] + getUser.main[4]*2);
                    gainHP = Math.floor(gainHP/playerClass[3]);
                    if (gainHP == 0) gainHP = 1;
                    getUser.classInfo = playerClass;


                } else if(chooseAbility==2) {
                    var extraDamage = randFromRange(1, 8);
                    printMessage(nickName + " uses <b>Maple Syrup Strike</b> and restores <b>"+attackModi.toString()+"</b> hp while adding "+ extraDamage.toString() + " to seasoning modifier.", "random", roomClient, "html");
                    var stats = getUser.main;
                    stats[2] = parseInt(stats[2]) + parseInt(extraDamage);
                    logToFile("extra damage added " + extraDamage.toString());
                    getUser.main = stats;
                }
                getUser.main[2] += getUser.classInfo[3];
                updatePlayer(getUser, self, senderId);
                break;
            default:
                return true;


        }
    }
	return true;
}

function postAttackFunc(playerObj, self, id){
    logToFile("PostAttackFunc")
    var self = self;
    var getUser = playerObj;
    if (!getUser.classInfo[3]){
        getUser.classInfo[3] == 0;
    }
    getUser.main[2] += getUser.classInfo[3];
    updatePlayer(getUser, self, id)


}
function logToFile(message){
    console.log(message);
}

app.listen();
getAllPeople(peopleInRoom);
logToFile(peopleInRoom);
fillMonsterChanceArray();
var fs = require('fs');
var obj = fs.readFileSync('alltime.json', 'utf8')
logToFile(obj.toString())
if (obj.toString() != ""){
    topScoresAll = JSON.parse(obj);
    logToFile(topScoresAll.toString());
}
var timer = setInterval(function() {
 logToFile("Adding 1 to everyone") 

 for(var i in increaseMonsterChance) {
    if (increaseMonsterChance[i] <= 15)
        increaseMonsterChance[i] += 1;
 }

}, 60000)
