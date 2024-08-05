const { MessageEmbed } = require('discord.js');
const Discord = require('discord.js');
const config = require("./config.json"); //Loading config file
let members = require("./members.json");
const axios = require('axios');
const fs = require("fs");
const path = require("path");
let http = require('http');
let https = require('https');
const surveyEmbeds = require('./survey.js');
const embeds = require('./embeds.js');




                                   /*#################################################################*/
//                                                               BOT
                                   /*#################################################################*/

let BOT_VERSION = "1.0";

// Announce start up
console.log(`Welcome Bot ${BOT_VERSION} starting up...`);
console.log(`Use the ${config.PREFIX} to see commands`);

// Admin Channels
let broadchastChannel = config.broadcast_channel;
let adminbroadcastChannel = config.adminbroadcastChannel;
let varrChannel = config.varrr_blocks_channel;
let verusChannel = config.verus_blocks_channel;
let vdexChannel = config.vdex_blocks_channel;



// Client creation
let discordClient = new Discord.Client({ 
    presence: { status: "invisible" },
    intents: ["GUILDS", "GUILD_MESSAGES","GUILD_MEMBERS"] 
}); 



                                   /*#################################################################*/
//                                                               Functions
                                   /*#################################################################*/


// For confirmed or orphaned blocks
let lastKnownBlockCounts = {};

// For block detection
let lastKnownBlocks = {
    varrr: 0,
    verus: 0,
    vdex: 0
};


// Define the base URLs for each block type
const baseUrlVarrr = config.baseUrlVarrr;
const baseUrlVerus = config.baseUrlVerus;
const baseUrlVdex = config.baseUrlVdex;

// Define the custom emoji IDs for each pool
const varrrEmojiId = config.varrrEmojiId; // Replace with the ID of your varrr emoji
const verusEmojiId = config.verusEmojiId; // Replace w
const vdexEmojiId = config.vdexEmojiId;

// Construct the URLs for the custom emojis on your server
const varrrEmojiUrl = `https://cdn.discordapp.com/emojis/${varrrEmojiId}.png`;
const verusEmojiUrl = `https://cdn.discordapp.com/emojis/${verusEmojiId}.png`;
const vdexEmojiUrl = `https://cdn.discordapp.com/emojis/${vdexEmojiId}.png`;



// Overall stats and pool stats 
async function getPoolStats() {
    const url = new URL(`${config.API_URL}/stats`);

    return new Promise((resolve, reject) => {
        https.get(url, response => {
            if (response.statusCode !== 200) {
                // If the server responds but not with a 200 OK, log and throw an error
                console.error(`Failed to fetch pool stats with status: ${response.statusCode}`);
                reject(new Error(`Failed to fetch pool stats with status: ${response.statusCode}`));
                response.resume(); // Consume response data to free up memory
                return;
            }

            response.setEncoding('utf8');
            let rawData = '';
            response.on('data', (chunk) => { rawData += chunk; });
            response.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    resolve(parsedData);
                } catch (e) {
                    console.error('Error parsing data:', e.message);
                    reject(new Error('Error parsing data'));
                }
            });
        }).on('error', (e) => {
            console.error(`Error fetching pool stats: ${e.message}`);
            reject(new Error(`Error fetching pool stats: ${e.message}`));
        });
    });
}

async function poolstats() {
    const url = `${config.API_URL}/pool_stats`;
    try {
        const response = await axios.get(url, { timeout: 20000 });
        //console.log("API Response Data:", response.data); // Log the full API response
        const data = response.data;

        if (!data || !Array.isArray(data) || data.length === 0 || !data[data.length - 1].pools) {
            console.error('API response does not contain expected data.');
            return null;
        }

        // Only return the last item in the array, which should be the latest data
        const latestData = data[data.length - 1];
        //console.log(latestData.pools.verus.blocks);
        return {
            time: latestData.time,
            pools: latestData.pools,
        };
    } catch (error) {
        console.error(`Failed to fetch data: ${error}`);
        return null;
    }
}


// Blocks data 
async function getBlockData() {
    try {
        const response = await axios.get(`${config.API_URL}/blocks`);
        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Failed to fetch block data: ', response.status);
            return null;
        }
    } catch (error) {
        console.error('Error fetching block data:', error);
        return null;
    }
}

// Parse for each blocks
function parseBlockData(data) {
    const blocks = { varrr: [], verus: [], vdex: [] };
    Object.entries(data).forEach(([key, value]) => {
        const parts = value.split(":");
        const block = {
            blockHash: parts[0],
            transactionId: parts[1],
            blockNumber: parts[2],
            miner: parts[3].split('.')[0], // Assuming you want to remove the tag after the dot
            timestamp: new Date(parseInt(parts[4])).toLocaleString()
        };
        if (key.startsWith("varrr")) {
            blocks.varrr.push(block);
        } else if (key.startsWith("verus")) {
            blocks.verus.push(block);
        } else if (key.startsWith("vdex")) {
            blocks.vdex.push(block);
        }
    });
    return blocks;
}


// Monitoring
async function monitorBlocks() {
    const blockData = await getBlockData();
    if (!blockData) {
        console.log("Failed to fetch block data.");
        return;
    }
    const parsedBlocks = parseBlockData(blockData);

    // Monitor for new varrr blocks
    const newVarrrBlocks = parsedBlocks.varrr.filter(block => parseInt(block.blockNumber) > lastKnownBlocks.varrr);
    if (newVarrrBlocks.length > 0) {
        lastKnownBlocks.varrr = Math.max(...newVarrrBlocks.map(block => parseInt(block.blockNumber)));
        notifyNewBlock(newVarrrBlocks, 'varrr');
    }

    // Monitor for new verus blocks
    const newVerusBlocks = parsedBlocks.verus.filter(block => parseInt(block.blockNumber) > lastKnownBlocks.verus);
    if (newVerusBlocks.length > 0) {
        lastKnownBlocks.verus = Math.max(...newVerusBlocks.map(block => parseInt(block.blockNumber)));
        notifyNewBlock(newVerusBlocks, 'verus');
    }


    // Monitor for new varrr blocks
    const newVdexBlocks = parsedBlocks.vdex.filter(block => parseInt(block.blockNumber) > lastKnownBlocks.vdex);
    if (newVdexBlocks.length > 0) {
        lastKnownBlocks.vdex = Math.max(...newVdexBlocks.map(block => parseInt(block.blockNumber)));
        notifyNewBlock(newVdexBlocks, 'vdex');
    }
}


// Notifications, for blocks detected
async function notifyNewBlock(blocks, type) {
    const title = `New ${type.charAt(0).toUpperCase() + type.slice(1)} Block Detected`;
    const messageFunction = type === 'varrr' ? varrrbroadcast :
                            type === 'verus' ? verusbroadcast :
                            vdexbroadcast;
    const color = type === 'varrr' ? '#9ea808' :
                  type === 'verus' ? '#180770':
                  '#5d0191';

    // Determine the base URL based on the block type
    const baseUrl = type === 'varrr' ? baseUrlVarrr :
                    type === 'verus' ? baseUrlVerus :
                    baseUrlVdex;

    // Set the appropriate emoji URL for the thumbnail
    const emojiUrl = type === 'varrr' ? varrrEmojiUrl :
                     type === 'verus' ? verusEmojiUrl :
                     vdexEmojiUrl;

    // Fetch registered members
    const registeredMembers = await fetchRegisteredMembers();

    // Construct mention string for registered members
    const mentionString = registeredMembers.map(memberId => `<@${memberId}>`).join(' ');

    const embed = new Discord.MessageEmbed()
        .setColor(color)
        .setTitle(title)
        .setDescription(`New blocks have been mined for ${type}!`)
        .setThumbnail(emojiUrl);


    blocks.forEach(block => {
        const explorerLink = baseUrl + block.blockHash; // Construct the full URL
        embed.addField(`Block Number: ${block.blockNumber}`, `[Hash: ${block.blockHash}](${explorerLink})\nTimestamp: ${block.timestamp}`, false);
    });

    messageFunction({ content: mentionString, embeds: [embed] });
}



// Monitoring for confirmed & orphaned
async function monitorBlockChanges() {
    const stats = await poolstats();
    if (!stats) {
        console.log("Failed to fetch pool stats.");
        return;
    }

    Object.entries(stats.pools).forEach(([poolName, poolData]) => {
        // Initialize last known counts if not already present
        if (!lastKnownBlockCounts[poolName]) {
            lastKnownBlockCounts[poolName] = {
                confirmed: poolData.blocks.confirmed,
                orphaned: poolData.blocks.orphaned
            };
            return; // Skip the first time setup
        }

        // Detect changes in block counts
        const lastCounts = lastKnownBlockCounts[poolName];
        if (poolData.blocks.confirmed !== lastCounts.confirmed) {
            notifyBlockChange(poolName, 'confirmed', poolData.blocks.confirmed);
            lastCounts.confirmed = poolData.blocks.confirmed; // Update last known count
        }
        if (poolData.blocks.orphaned !== lastCounts.orphaned) {
            notifyBlockChange(poolName, 'orphaned', poolData.blocks.orphaned);
            lastCounts.orphaned = poolData.blocks.orphaned; // Update last known count
        }
    });
}

// Notifications, for confirmed & orphaned
async function notifyBlockChange(poolName, statusType, count) {
    // Assume broadcast functions are globally defined as varrrbroadcast or verusbroadcast
    // and that they handle notifications for any types of messages (both pools if necessary).
    const messageFunction = (poolName === 'varrr' ? varrrbroadcast :
                             poolName === 'verus' ? verusbroadcast :
                             poolName === 'vdex' ? vdexbroadcast : null
                            );

    if (!messageFunction) {
        console.error("Notification channel not found for pool:", poolName);
        return;
    }

    const color = statusType === 'confirmed' ? '#32a852' : '#db0909';
    // Set the appropriate emoji URL for the thumbnail
    //const emojiUrl = statusType === 'varrr' ? varrrEmojiUrl : verusEmojiUrl;

    const embed = new Discord.MessageEmbed()
        .setColor(color)
        .setTitle(`${poolName.toUpperCase()} ${statusType} Block Update`)
        .setDescription(`${poolName.toUpperCase()} now has ${count} ${statusType} blocks. 🪙`);


        messageFunction({ embeds: [embed] });
}

// Function to fetch registered members from members.json
async function fetchRegisteredMembers() {
    const membersData = await fs.promises.readFile('members.json');
    const members = JSON.parse(membersData);
    return Object.entries(members)
        .filter(([_, member]) => member.block_notify === 'on')
        .map(([userId, _]) => userId);
}

async function removeMember(memberId) {
    try {
        const membersData = await fs.promises.readFile('members.json');
        const members = JSON.parse(membersData);

        if (members[memberId]) {
            delete members[memberId];
            await fs.promises.writeFile('members.json', JSON.stringify(members, null, 2));
            console.log(`Member with ID ${memberId} has been removed.`);
            return true; // Indicate successful removal
        } else {
            console.log(`Member with ID ${memberId} not found.`);
            return false; // Indicate member not found
        }
    } catch (error) {
        console.error('Error removing member:', error);
        return false; // Indicate error
    }
}

function formatHashrate(hashrate) {
    if (hashrate === 0) {
        return "mergemining";  // Return custom text for zero hashrate
    }

    // Define units for display
    const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s', 'ZH/s', 'YH/s'];
    let unitIndex = 0;

    // Divide by 1000 repeatedly to scale down the hashrate appropriately
    while (hashrate >= 1000 && unitIndex < units.length - 1) {
        hashrate /= 1000;
        unitIndex++;
    }

    // Force the unit to GH/s if it exceeds, assuming most interest is in GH/s for high values
    if (unitIndex > 3) { // If index exceeds that of GH/s, reset to GH/s
        unitIndex = 3; // Sets the index to GH/s
    }

    // Format the hashrate with two decimal places and append the appropriate unit
    return `${hashrate.toFixed(2)} ${units[unitIndex]}`;
}

// Convert a hashrate into a hashrateString
function getHashString(hashrate) {
    hashrate = (hashrate * 1000000);
    if (hashrate < 1000000)
      return '0 H ';
    var byteUnits = [ ' H ', ' KH', ' MH', ' GH', ' TH', ' PH' ];
    var i = Math.floor((Math.log(hashrate/1000) / Math.log(1000)) - 1);
    hashrate = (hashrate/1000) / Math.pow(1000, i + 1);
    return hashrate.toFixed(2) + byteUnits[i];
}



function saveMembers(reason) {
    fs.writeFile(path.join(__dirname, 'members.json'), JSON.stringify(members, null, 2), err => {
        if (err) {
            console.error('Failed to save member data:', err);
        } else {
            console.log(reason);
        }
    });
}


// Set the current Hash Rate and Miner Count as the bot's activity
async function setActivity() {
    const data = await getPoolStats();
    let activity = `${data.pools.verus.hashrateString}`;
    discordClient.user.setActivity(activity, {
        type: 'WATCHING'
    });
}


                                   /*#################################################################*/
//                                                               Discord
                                   /*#################################################################*/


// Discord Client Ready Event
discordClient.on("ready", () => {
    console.log("Bot is ready and now monitoring blocks...");
    // Set the default activity to 'watching Veruscoin' 
    discordClient.user.setActivity(`Veruscoin | MergeMining`, {
        type: 'WATCHING'
    })
    // Run monitoring functions immediately on start
    monitorBlockChanges();
    monitorBlocks();
    setActivity();

    // Set intervals for repeated monitoring and activity updates
    setInterval(monitorBlocks, 25000); // Adjust the timing as needed
    setInterval(monitorBlockChanges, 25000);
    setInterval(setActivity, 20000);

    console.log(`Logged in as ${discordClient.user.tag}!`);
});                                   

// Start of discord Bot commands and messaging
// This is also where monitoring & intervals for block checks begin
discordClient.on("messageCreate", async message => {
    console.log("Message event ready...");

    console.log(`[${message.author.tag}]: ${message.content}`);
    // Ignore the message if it has been generated by a bot
    if (message.author.bot) return;

    // Populate the botAdminRoles array
    console.log(`Setting admin roles to ${config.bot_admin_roles}`);
    botAdminRoles = config.bot_admin_roles.split(",");

    // Ignore the message if the prefix does not exist
    if (message.content.indexOf(config.PREFIX) !== 0) return;

    // Store the message author for ease of reference later
    let messageSender = message.member.user;

    // Define the member in the members JSON object if they haven't been seen yet
    // This will avoid issues when querying data points that are not yet defined
    if (!members[messageSender.id])
        members[messageSender.id] = {};

    // Split the message into an array of arguments and set the first element as the command
    let args = message.content.slice(config.PREFIX.length).trim().split(/ +/g);
    let command = args.shift().toLowerCase();

    // Determine if the user is in a role defined in the "bot_admin_roles" declaration to allow for admin commands
    let isAdmin = false;
    for (var i = 0; i < botAdminRoles.length; i++) {
        if (message.guild.roles.cache.find(role => role.name === config.bot_admin_roles)) isAdmin = true;
    }

                                      /*#################################################################*/
//                                                               COMMANDS
                                   /*#################################################################*/

    // Bot Admin Commands
    if (isAdmin) {
        if (command === "echo") {
            // Delete the command message
            message.delete().catch(O_o => {});
            // Echo the message
            let msg = args.join(" ");
            sendReply(message, msg);
        } else if (command === "broadcast") {
            // Delete the command message
            message.delete().catch(O_o => {});
            // Broadcast the message
            let msg = args.join(" ");
            broadcast(msg);
        } else if (command === "save") {
            // Execute saveAll
            saveAll();
            // Notify the message author of the completion of the task
            let messageAuthor = message.author;
            messageAuthor.send("All configurations have been saved.");
            // Delete the command message
            message.delete().catch(O_o => {});
        }
    }

    const isServerOwner = message.guild.ownerId === message.author.id;

     // welcome embed
    if (command === "welcome") {
        broadcast({ embeds: [embeds.welcome] });
    } else if (command === "reminder") {
        broadcast({ embeds: [embeds.reminder] });
    } else if (command === "rules") {
        broadcast({ embeds: [embeds.rules] });
    } else     if (command === 'warning') {
        // Check if the user issuing the command is the server owner
        const isServerOwner = message.guild && message.guild.ownerId === message.author.id;

        // Warn member 
        if (!isServerOwner) {
            message.channel.send("You don't have permission to issue warnings.");
            return;
        }

        // Check if a user was mentioned in the command
        const user = message.mentions.users.first();
        if (!user) {
            message.channel.send("Please mention a user to warn.");
            return;
        }

        // Check if a reason was provided
        const reason = args.join(" ");
        if (!reason) {
            message.channel.send("Please provide a reason for the warning.");
            return;
        }

        // Send the warning embed using the function from the embeds module
        const warningEmbed = embeds.warning(message, user, reason);
        broadcast({ embeds: [warningEmbed] });
    } else if (command === 'help') {
        const isMod = message.member.permissions.has("MANAGE_MESSAGES");
        const isServerOwner = message.guild.ownerId === message.author.id;

        if (isMod || isServerOwner) {
            message.channel.send({ embeds: [embeds.help.adminCommands, embeds.help.regularCommands] });
        } else {
            message.channel.send({ embeds: [embeds.help.regularCommands] });
        }
    }else if (command === "restore") {
        // Check if a YouTube video URL was provided
        const videoUrl = args[0];
        if (!videoUrl || !videoUrl.startsWith("https://www.youtube.com/")) {
            broadcast("https://www.youtube.com/watch?v=EO6EdPY32Rk&ab_channel=VerusCoinCommunity");
            return;
        }
    
        // Extract video ID from the URL
        const videoId = videoUrl.split("v=")[1];
    
        // Create and send the embed
        const youtubeEmbed = new MessageEmbed()
            .setColor("#ff0000")
            .setTitle("Restore Wallet")
            .setDescription("How to restore wallet from backup:")
            .addField("Video Title", "How to restore your native wallet", true) // Replace "Title of the video" with the actual title
            .addField("Description", "How to restore wallet from backup", true) // Replace "Description of the video" with the actual description
            .setImage(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
            .setURL(videoUrl);
    
        broadcast({ embeds: [youtubeEmbed] });
    }else if (command === 'referral') {
        broadcast({ embeds: [embeds.referral] });
    } else if (command === "stats") {
        try {
            const data = await getPoolStats();
            const embeds = [];
    
            // Define color mapping for pools based on pool name or other identifier
            const colorMap = {
                'varrr': '#c7b302',   // yellow'varrr'
                'verus': '#180770'    // Blue'verus'
                // Add more mappings as necessary for additional pools
            };
    
            // Iterate through each pool in the data and create an embed for each
            for (const pool of Object.values(data.pools)) {
                // Use a default color if pool.name is not in colorMap
                const embedColor = colorMap[pool.name.toLowerCase()] || '#dddddd';

            // Parse all necessary values, handling zeros with "mergemining"
            const hashrateValue = parseInt(pool.hashrateString) === 0 ? "mergemining" : pool.hashrateString;
            const invalidSharesValue = parseInt(pool.poolStats.invalidShares) === 0 ? "mergemining" : pool.poolStats.invalidShares;
            const validBlocksValue = parseInt(pool.poolStats.validBlocks) === 0 ? "mergemining" : pool.poolStats.validBlocks;
            const networkConnectionsValue = parseInt(pool.poolStats.networkConnections) === 0 ? "mergemining" : pool.poolStats.networkConnections;
            const validSharesValue = parseInt(pool.poolStats.validShares) === 0 ? "mergemining" : pool.poolStats.validShares;

            // Checking and formatting totalPaid
            let totalPaidValue = pool.poolStats && pool.poolStats.totalPaid ? parseFloat(pool.poolStats.totalPaid) : 0;
            totalPaidValue = totalPaidValue === 0 ? "mergemining" : totalPaidValue.toFixed(4);  // Limiting decimal places to four

    
    
                const embed = new MessageEmbed()
                    .setColor(embedColor)
                    .setTitle(`${pool.name} Stats`)
                    .setDescription(`Symbol: ${pool.symbol}\nAlgorithm: ${pool.algorithm}`)
                    .addFields(
                        { name: 'Hashrate', value: hashrateValue, inline: true }, 
                        { name: 'Connections', value: `${networkConnectionsValue}`, inline: true },
                        { name: 'Valid Blocks', value: `${validBlocksValue}`, inline: true },
                        { name: 'Invalid Shares', value: `${invalidSharesValue}`, inline: true },
                        { name: 'Valid Shares', value: `${validSharesValue}`, inline: true },
                        { name: 'Total Paid', value: `${totalPaidValue}`, inline: true }
                    );
                embeds.push(embed);
            }
    
            // Send all embeds in one message (handle potential API limits)
            for (let i = 0; i < embeds.length; i += 10) {
                broadcast({ embeds: embeds.slice(i, Math.min(i + 10, embeds.length)) });
            }
        } catch (err) {
            console.error(err);
            broadcast('Error fetching pool stats.');
        }
    } else if (command === "poolstats") {
        try {
            const stat = await poolstats();
            //console.log(stat)
            if (!stat) {
                broadcast("No pool stats available.");
                return;
            }

            // Create an embed for each pool
            Object.entries(stat.pools).forEach(([poolName, poolData]) => {
                //console.log(poolData)
                const color = poolName === 'varrr' ? '#c7b302' : '#180770'; // gold for 'varrr', Blue for 'verus'

            // Check for zero hashrate and worker count and adjust values accordingly
            //const hashrateValue = poolData.hashrate === 0 ? "mergemining" : `${poolData.hashrate} H/s`;
            const workerCountValue = poolData.workerCount === 0 ? "mergemining" : poolData.workerCount.toString();
            // Format hashrate using the defined function
            const hashrateValue = formatHashrate(poolData.hashrate);


                const embed = new MessageEmbed()
                    .setColor(color)
                    .setTitle(`${poolName.charAt(0).toUpperCase() + poolName.slice(1)} Pool Stats`)
                    .setDescription(`Latest stats as of: ${new Date(stat.time * 1000).toLocaleString()}`)
                    .addFields(
                        { name: 'Net Hash', value: hashrateValue, inline: true },
                        { name: 'Worker Count', value: workerCountValue, inline: true },
                        { name: '\u200B', value: '**Block Statistics:**', inline: false }, // Use invisible character to create space
                        { name: 'Pending Blocks', value: `${poolData.blocks.pending}`, inline: true },
                        { name: 'Confirmed Blocks', value: `${poolData.blocks.confirmed}`, inline: true },
                        { name: 'Orphaned Blocks', value: `${poolData.blocks.orphaned}`, inline: true },
                    );

                broadcast({ embeds: [embed] });
            });

        } catch (err) {
            console.error(err);
            message.channel.send('Error fetching pool stats.');
        }
    } else if (command === "blocks") {
        const blockData = await getBlockData();
        if (!blockData) {
            message.channel.send("Failed to fetch block data.");
            return;
        }
        const parsedBlocks = parseBlockData(blockData); // This now returns an object with 'varrr' and 'verus' arrays
    

        // Assuming you have the custom emoji objects available
        const verusEmoji = message.guild.emojis.cache.get(verusEmojiId);
        const varrrEmoji = message.guild.emojis.cache.find(emoji => emoji.name === 'Pirate_Logo_Coin_Gold');

    
        // Display varrr blocks
        if (parsedBlocks.varrr.length > 0) {
            const varrrEmbed = new Discord.MessageEmbed()
                .setColor('#9ea808')
                .setTitle('Current Varrr Blocks')
                .setThumbnail(varrrEmoji.url); 
    
            parsedBlocks.varrr.forEach((block, index) => {
                if (index < 1) { // Limit to 1 block to avoid spamming
                    varrrEmbed.addField(`Block Number: ${block.blockNumber}`, `Explorer: [${block.blockHash}](${baseUrlVarrr}${block.blockHash})\nTimestamp: ${block.timestamp}`, false);
                }
            });
            broadcast({ embeds: [varrrEmbed] });
        } else {
            broadcast("No Varrr blocks data available.");
        }
    
        // Display verus blocks
        if (parsedBlocks.verus.length > 0) {
            const verusEmbed = new Discord.MessageEmbed()
                .setColor('#180770')
                .setTitle('Current Verus Blocks')
                .setThumbnail(verusEmoji.url);
    
            parsedBlocks.verus.forEach((block, index) => {
                if (index < 1) { // Limit to 1 block to avoid spamming
                    verusEmbed.addField(`Block Number: ${block.blockNumber}`, `Explorer: [${block.blockHash}](${baseUrlVerus}${block.blockHash})\nTimestamp: ${block.timestamp}`, false);
                }
            });
            broadcast({ embeds: [verusEmbed] });
        } else {
            broadcast("No Verus blocks data available.");
        }
    } else if (command === "workers") {
        try {
            // Check if user has registered a wallet address
            if (!members[messageSender.id] || !members[messageSender.id].wallet) {
                message.channel.send("You haven't registered a wallet address yet. Use £register [wallet] to register your wallet address.");
                return;
            }
    
            const stats = await getPoolStats();
            if (!stats || !stats.pools.verus || !stats.pools.verus.workers) {
                message.channel.send("No Verus worker stats available.");
                return;
            }
    
            const userWallet = members[messageSender.id].wallet;
            const verusWorkers = stats.pools.verus.workers;
    
            // Filter workers based on user's registered wallet address
            const userWorkers = Object.entries(verusWorkers).filter(([workerId, workerDetails]) => {
                return workerId.startsWith(userWallet);
            });
    
            if (userWorkers.length === 0) {
                message.channel.send("No workers found in the Verus pool associated with your registered wallet address.");
                return;
            }
    
            // Group workers by name
            const groupedWorkers = {};
            userWorkers.forEach(([workerId, workerDetails]) => {
                const workerName = workerDetails.name;
                if (groupedWorkers[workerName]) {
                    groupedWorkers[workerName].push(workerDetails.hashrateString);
                } else {
                    groupedWorkers[workerName] = [workerDetails.hashrateString];
                }
            });
    
            // Create and send embedded message for grouped worker details
            const embeds = [];
            let currentEmbed = new MessageEmbed()
                .setColor('#180770') // Blue for Verus
                .setTitle(`Verus Pool Workers for ${userWallet}`)
                .setDescription(`Grouped details for workers in the Verus pool associated with your registered wallet address.`);
            let fieldsCount = 0;
    
            Object.entries(groupedWorkers).forEach(([name, hashrates]) => {
                const fieldString = `Worker: ${name}\nHashrates: ${hashrates.join(', ')}`;
                if (currentEmbed.length + fieldString.length > 6000 || fieldsCount >= 25) {
                    // If adding this field would exceed the limits, start a new embed
                    embeds.push(currentEmbed);
                    currentEmbed = new MessageEmbed()
                        .setColor('#180770') // Blue for Verus
                        .setTitle(`Verus Pool Workers for ${userWallet}`)
                        .setDescription(`Grouped details for workers in the Verus pool associated with your registered wallet address.`);
                    fieldsCount = 0;
                }
    
                currentEmbed.addField(`Worker: ${name}`, `Hashrates: ${hashrates.join(', ')}`, false);
                fieldsCount++;
            });
    
            // Push the last embed
            embeds.push(currentEmbed);
    
            // Send all embeds
            embeds.forEach(embed => {
                messageSender.send({ embeds: [embed] });
            });
    
        } catch (err) {
            console.error(err);
            messageSender.send('Error fetching Verus worker stats.');
        }
    } else if (command === "register") {
        const embed = new MessageEmbed();
    
        // Ensure the message sender is defined in members.json
        if (!members[messageSender.id]) {
            members[messageSender.id] = {};
        }
    
        // Check if any arguments were provided with the command
        if (args.length === 0) {
            // Provide usage information if no arguments are provided
            embed.setColor('#0099ff')
                .setTitle('Register Command Usage')
                .setDescription(`${messageSender}, follow the correct format to use this command:\n`)
                .addFields(
                    { name: 'Set your wallet address and block notifications', value: `\`${config.PREFIX}register [wallet] [on/off]\``, inline: false },
                    { name: 'Remove your registration', value: `\`${config.PREFIX}register forget\``, inline: false }
                );
            // Send the embed message
            message.channel.send({ embeds: [embed] });
            return;
        }
    
        // Check if the first argument is "forget"
        if (args[0].toLowerCase() === "forget") {
            // Command to remove the registration
            if (members[messageSender.id]) {
                // Remove the member from the file
                removeMember(messageSender.id).then(() => {
                    // Remove the member from the members object
                    delete members[messageSender.id];
                    // Confirmation message
                    embed.setColor('#ff0000')
                        .setTitle('Registration Removed')
                        .setDescription(`${messageSender}, your registration has been removed.`);
                    // Send the embed message
                    message.channel.send({ embeds: [embed] });
                }).catch(err => {
                    console.error('Failed to remove member:', err);
                });
            } else {
                // If the member is not registered
                embed.setColor('#ff0000')
                    .setTitle('Not Registered')
                    .setDescription(`${messageSender}, you are not registered. There's nothing to forget.`);
                // Send the embed message
                message.channel.send({ embeds: [embed] });
            }
            return;
        }
    
        // If user is already registered and provided argument is "on" or "off", update notification preference
        if (members[messageSender.id].wallet && (args[0].toLowerCase() === 'on' || args[0].toLowerCase() === 'off')) {
            // Update the block_notify value
            members[messageSender.id].block_notify = args[0].toLowerCase();
            // Create the embed message
            const notifyEmbed = new MessageEmbed()
                .setColor('#00ff00')
                .setTitle('Notification Preference Updated')
                .setDescription(`${messageSender}, your notification preference has been updated.`)
                .addField('Block Notifications', args[0].toUpperCase(), true);
            // Save the updated member data
            saveMembers("Member registration data updated");
            // Send the embed message
            message.channel.send({ embeds: [notifyEmbed] });
            return;
        }
    
        // Set the wallet address to the provided argument if available
        if (args.length > 0) {
            members[messageSender.id].wallet = args[0];
    
            // Check if block notifications option is provided
            if (args.length > 1 && (args[1].toLowerCase() === 'on' || args[1].toLowerCase() === 'off')) {
                // Set block notify status
                members[messageSender.id].block_notify = args[1].toLowerCase();
                // Confirmation message with block notification status
                embed.setColor('#00ff00')
                    .setTitle('Wallet Registered')
                    .setDescription(`${messageSender}, your wallet has been set to: \`${args[0]}\``)
                    .addField('Block Notifications', `${args[1].toUpperCase()}`, true);
                    message.channel.send({ embeds: [embed] });
            } else {
                // Confirmation message without block notification status
                embed.setColor('#00ff00')
                    .setTitle('Wallet Registered')
                    .setDescription(`${messageSender}, your wallet has been set to: \`${args[0]}\``);
                    message.channel.send({ embeds: [embed] });
            }
        } else {
            // If no arguments are provided other than "forget"
            embed.setColor('#ff0000')
                .setTitle('Invalid Command')
                .setDescription(`${messageSender}, please provide valid arguments or use \`${config.PREFIX}register\` command for usage information.`);
                message.channel.send({ embeds: [embed] });
        }
    
        // Save the updated member data
        saveMembers("Member wallet data updated");
    
    
        // Send the embed message
        message.channel.send({ embeds: [embed] });
    } else if (command === "me") {
        // Ensure the user's wallet address is defined
        if (!members[messageSender.id].wallet)
            members[messageSender.id].wallet = "";
    
        let embed = new MessageEmbed();
        let msg = '';
    
        if (members[messageSender.id].wallet > "") {
            let walletID = members[messageSender.id].wallet;
    
            // Get pool stats
            const stats = await getPoolStats();
            if (!stats || !stats.pools.verus || !stats.pools.verus.workers) {
                message.channel.send("No Verus worker stats available.");
                return;
            }
    
            const verusWorkers = stats.pools.verus.workers;
            let userWorkers = {};
            for (const workerKey in verusWorkers) {
                if (workerKey.startsWith(walletID)) {
                    userWorkers[workerKey] = verusWorkers[workerKey];
                }
            }
    
            let addressHashrate = 0;
            for (const workerHashrate of Object.values(userWorkers)) {
                addressHashrate += workerHashrate.hashrate;
            }
    
            addressHashrate /= 500000;
            let addressHashrateString = getHashString(addressHashrate);
    
            embed.setColor('#0099ff')
                .setTitle(`${messageSender.username}'s Pool Details`)
                .addFields(
                    { name: 'Address', value: walletID },
                    { name: 'Hashrate', value: addressHashrateString }
                );
        } else {
            // If the user has not registered a wallet address
            embed.setColor('#ff0000')
                .setDescription("You haven't registered a wallet address yet. Use `£register [wallet]` to register your wallet address.");
        }
    
        // Send the embed message
        messageSender.send({ embeds: [embed] });
    } else if (command === "members") {
        // Check if the message author is the server owner
        if (message.guild && message.author.id === message.guild.ownerId) {
            fs.readFile('members.json', (err, data) => {
                if (err) {
                    console.error('Error reading members.json:', err);
                    adminbroadcast("An error occurred while reading registered members.");
                    return;
                }
    
                try {
                    const members = JSON.parse(data);
                    let embed = new MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle('Registered Members');
    
                    if (Object.keys(members).length > 0) {
                        embed.setDescription("List of registered members:");
    
                        for (const memberId in members) {
                            let wallet = members[memberId].wallet || "Not set";
                            let member = message.guild.members.cache.get(memberId);
                            if (member) {
                                embed.addField(member.user.username, `ID: ${memberId}, Wallet: ${wallet}`);
                            } else {
                                embed.addField("Unknown Member", `ID: ${memberId}, Wallet: ${wallet}`);
                            }
                        }
                    } else {
                        embed.setDescription("No registered members found.");
                    }
    
                    adminbroadcast({ embeds: [embed] });
                } catch (error) {
                    console.error('Error parsing members data:', error);
                    adminbroadcast("An error occurred while processing registered members data.");
                }
            });
        } else {
            adminbroadcast("You must be the server owner to use this command.");
        }
    } else if (command === "survey") {
        const surveyIndex = parseInt(args[0]) - 1; // Subtract 1 to convert number to array index
        const survey = surveyEmbeds[surveyIndex];
        const isServerOwner = message.guild.ownerId === message.author.id;
        
    
        if (!survey) {
            message.channel.send("Survey not found.");
            return;
        }
    
        const surveyEmbed = new MessageEmbed()
            .setColor(survey.color)
            .setTitle(survey.title)
            .setDescription(survey.description)
            .addFields(...survey.fields);
    
        // Send appropriate embed based on user role
        if (isServerOwner) {
            message.channel.send({ embeds: [surveyEmbed] });
        } else {
            return;
        }
    }
});


                                   /*#################################################################*/
//                                                               Channels
                                   /*#################################################################*/


// Broadcasts messages in the channels 

function broadcast(message) {
    if (message.length == 0) return;

    discordClient.channels.cache.get(broadchastChannel).send(message).catch(O_o => {}); // Catch to avoid logging channel permission issues
    
}

function adminbroadcast(message) {
    if (message.length == 0) return;

    discordClient.channels.cache.get(adminbroadcastChannel).send(message).catch(O_o => {}); // Catch to avoid logging channel permission issues
    
}

function verusbroadcast(message) {
    if (message.length == 0) return;

    discordClient.channels.cache.get(verusChannel).send(message).catch(O_o => {}); // Catch to avoid logging channel permission issues
    
}

function varrrbroadcast(message) {
    if (message.length == 0) return;

    discordClient.channels.cache.get(varrChannel).send(message).catch(O_o => {}); // Catch to avoid logging channel permission issues
    
}

function vdexbroadcast(message) {
    if (message.length == 0) return;

    discordClient.channels.cache.get(vdexChannel).send(message).catch(O_o => {}); // Catch to avoid logging channel permission issues
    
}

// Reply to an incoming message with given text
function sendReply(message, text)
{
    message.channel.send(text)
		.then(sentMessage => {
      		// After 60 seconds, delete the sent message
      		setTimeout(() => {
        		sentMessage.delete().catch(function (e) {
          			console.log(`Error encountered while deleting message\r\n${e}`);
        		});
      		}, 60000); // 60 seconds in milliseconds
    	})
    	.catch(function (e) {
        	console.log(`Error encountered in sendReply\r\n${e}`)
    	});
}



// Saves
//////////

function writeToFile(filePath, data) {
    fs.writeFile(path.resolve(__dirname, filePath), data, (err) => {
        if (err) {
            console.error(`Failed to write to ${filePath}:`, err);
        } else {
            console.log(`Data successfully written to ${filePath}`);
        }
    });
}

function saveAll() {
    saveConfig();
    saveMembers();
}

function saveConfig() {
    console.log('Writing config to config.json');
    writeToFile('./config.json', JSON.stringify(config, null, 2)); // Use null, 2 for pretty-printing
}

function saveMembers(reason) {
    console.log('Writing members to members.json');
    if (reason) console.log(`Reason: ${reason}`);
    writeToFile('./members.json', JSON.stringify(members, null, 2)); // Use null, 2 for pretty-printing
}




discordClient.login(config.BOT_TOKEN);