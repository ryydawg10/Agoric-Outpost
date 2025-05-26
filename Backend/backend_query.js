const https = require('http');
const httpsReal = require('https');
const client = require('./redis');
const { timeStamp } = require('console');

//real time variables(rt)
let rtSuccessCount = 0;
let rtFailCount = 0;
let rtBlockData= {sends: 0, delegations: 0, tSuccessCount : 0, tFailCount: 0, rewards: 0};
let rtTenMinSend = 0;
let rtTenMinDelegation = 0;
let rtTenMinRewards = 0;
let rtBlockHeight;
let rtPreviousTs;
let rtCurrentTs;
let rtEntryTime = null;
let fetchRtDataRetry = true;
let fetchRtTimeStampRetry = true;

//historical variables(hs)
let hsSuccessCount = 0;
let hsFailCount = 0;
let hsBlockData = {sends: 0, delegations: 0, tSuccessCount :0, tFailCount: 0, rewards: 0};
let hsTenMinSend = 0;
let hsTenMinDelegation = 0;
let hsTenMinRewards = 0;
let hsBlockHeight;
let hsPreviousTs;
let hsCurrentTs;
let fetchHsDataRetry = true;
let fetchHsTimeStampRetry = true;


start();


function getLatestBlock() //gets the latest block height on the chain
{
  return new Promise((resolve,reject) => {
  https.get('http://65.109.34.121:36657/status?', (resp) => {
    let data = '';
  
    resp.on('data', (chunk) =>  {
      data += chunk;
    });
  
    resp.on('end', () => {
      let status = JSON.parse(data);
      let newestHeight = status.result.sync_info.latest_block_height;
      resolve(newestHeight);
    })
  })
})
}



function findData(jsonBlock) //gets data from a block and decodes from base64
{
  let blockSends = 0;
  let blockDelegations = 0;
  let success = 0;
  let fail = 0;
  let blockRewards = 0;
  let k = 0;
  //rewards
  if(jsonBlock.result.begin_block_events != null) {
    while(jsonBlock.result.begin_block_events[k] != null) {
      if(jsonBlock.result.begin_block_events[k].type == 'rewards' && (jsonBlock.result.begin_block_events[k].attributes[0] != null && jsonBlock.result.begin_block_events[k].attributes[0].value != null)) {
        let base64Reward = jsonBlock.result.begin_block_events[k].attributes[0].value;
        let decodedBufferReward = Buffer.from(base64Reward, 'base64');
        let decodedReward = decodedBufferReward.toString('utf8');
        decodedReward = decodedReward.substring(0,decodedReward.length - 4);
        decodedReward = Number(decodedReward);
        decodedReward = Math.floor(decodedReward);
        if(!isNaN(decodedReward)) {
          blockRewards+=decodedReward;
        }
      } 
      k++;
    }
  }
  //no transaction
  if(jsonBlock.result.txs_results == null) {
    let dataObject = {sends: blockSends, delegations: blockDelegations, tSuccessCount: success, tFailCount: fail, rewards: blockRewards};
    return dataObject;
  }
  let tx_results = jsonBlock.result.txs_results;
  let i = 0;
  while(tx_results[i] != null) {
    for(let j=0;j<tx_results[i].events.length;j++) {
      //delegations
      if((tx_results[i].events[j].type == 'delegate') && (tx_results[i].events[j].attributes[1]!=null&&tx_results[i].events[j].attributes[1].value!=null)) {
        let base64Delegation = tx_results[i].events[j].attributes[1].value;
        let decodedBufferDelegation = Buffer.from(base64Delegation, 'base64');
        let decodedDelegation = decodedBufferDelegation.toString('utf8');
        decodedDelegation = decodedDelegation.substring(0,decodedDelegation.length - 4);
        decodedDelegation = Number(decodedDelegation);
        if(!isNaN(decodedDelegation)) {
          blockDelegations+=decodedDelegation;
        }
      }
      //sends
      if((tx_results[i].events[j].type == 'transfer') && (tx_results[i].events[j].attributes[2]!=null&&tx_results[i].events[j].attributes[2].value!=null)) {
        let base64Transfer = tx_results[i].events[j].attributes[2].value;
        let decodedBufferTransfer = Buffer.from(base64Transfer, 'base64');
        let decodedTransfer = decodedBufferTransfer.toString('utf8');
        decodedTransfer = decodedTransfer.substring(0,decodedTransfer.length - 4);
        decodedTransfer = Number(decodedTransfer);
        if(!isNaN(decodedTransfer)) {
          blockSends+=decodedTransfer;
        }
      }
    }
    //success/fail
    if(tx_results[i].code == 0) {
      success++;
    }
    else {
      fail++;
    }
    i++
  }
  let dataObject = {sends: blockSends, delegations: blockDelegations ,tSuccessCount: success, tFailCount: fail, rewards: blockRewards};
  return dataObject;
}


//stores realtime data in redis
async function storeNewSend(send, delegation, successFail, rewards) { //stores sends at the front of redis list
  await client.LPUSH('sends_data', send);
  await client.LPUSH('delegation_data', delegation);
  await client.LPUSH('success/fail_data', successFail);
  await client.LPUSH('rewards_data', rewards);
  let length =  await client.lLen('sends_data');
  if (length>4030) //starts deleting old entries when a full month of data is stored
  {
    await client.RPOP('sends_data');
    await client.RPOP('delegation_data');
    await client.RPOP('success/fail_data');
    await client.RPOP('rewards_data');
  }
}
//Stores historical data in redis
async function storeOldSend(send, delegation, successFail, rewards) { //stores sends at the back of redis list
  await client.RPUSH('sends_data', send);
  await client.RPUSH('delegation_data', delegation);
  await client.RPUSH('success/fail_data', successFail);
  await client.RPUSH('rewards_data', rewards);
}

/*
The realTimeQuery function and historicalQuery work together for the first 10 minute interval of data and diverge after to ensure the first 10 minute interval is accurate.
For the first 10 minute interval, realTimeQuery and historicalQuery share the same counters(rtTenMinSends, rtTenMinDelegations, rtSuccessCount, rtFailCount, rtTenMinRewards). 
RealTimeQuery moves forward and historicalQuery moves backwards. Once historicalQuery reaches it's end of the 10 minute interval it starts using it's own sum from then on immedietly.
If realtimeQuery reaches its end of the chunk before historicalQuery it waits for historicalQuery to reach it's end of the chunk before sending the data to redis and moving onto the next chunk.
Each function finds the even 10 minute points by comparing the timestamp of the current block to the timestamp of the block before it.
*/

//Main function for real time data
async function realTimeQuery() {
  let firstBlock = false;
  rtBlockHeight = await getLatestBlock(); //records current block height
  hsBlockHeight = rtBlockHeight - 1; //sets the starting block for HistoricalQuery
  while (true) {

    while (fetchRtTimeStampRetry == true && firstBlock == false) { //retry logic for getRealTimeBlockTime
      rtPreviousTs = await getRealTimeBlockTime(rtBlockHeight - 1);
      if (fetchRtTimeStampRetry == true) {
        await delay(5000);
      }
    }
    if(firstBlock == false){ //reset retry flag on first block
      fetchRtTimeStampRetry = true;
    }
    while (fetchRtDataRetry == true) { //retry logic for getRealTimeData
      await getRealTimeData();
      if (fetchRtDataRetry == true) {
        await delay(5000);
      }
    }

    while (fetchRtTimeStampRetry == true){ //retry logic for getRealTimeBlockTime
      rtCurrentTs = await getRealTimeBlockTime(rtBlockHeight);
      if (fetchRtTimeStampRetry == true) {
        await delay(5000);
      }
    }

    if(firstBlock == false) {
      hsPreviousTs = rtCurrentTs;//sets the previous block timestamp for the historicalQuery function to avoid the edge case where the program starts exactly on an even 10 minute point. 
      firstBlock = true;
    }

    if(rtCurrentTs.substring(15,16) == '0' && rtPreviousTs.substring(15,16) != rtCurrentTs.substring(15,16)) {//finds the end of the 10 minute interval. substring(15,16) is the minute digit.
      while(rtEntryTime == null) {//waits for historicalQuery to reach the end of the first interval before finalizing the first 10 minute interval
        await delay(1000);
      }

      //format and store in redis excluding current block
      let formattedTs = rtEntryTime.substring(0,11) + " " + rtEntryTime.substring(11,17);
      rtTenMinSend = formatToBLD(rtTenMinSend);
      let sendsJsonStr = {value: rtTenMinSend, timeStamp: formattedTs};
      sendsJsonStr = JSON.stringify(sendsJsonStr);
      rtTenMinDelegation = formatToBLD(rtTenMinDelegation);
      let delegationsJsonStr = {value: rtTenMinDelegation, timeStamp: formattedTs};
      delegationsJsonStr= JSON.stringify(delegationsJsonStr);
      let newSuccessFail = {success: rtSuccessCount, fail: rtFailCount, timeStamp: formattedTs};
      newSuccessFail = JSON.stringify(newSuccessFail);
      rtTenMinRewards = formatToBLD(rtTenMinRewards);
      let newRewards = {value: rtTenMinRewards, timeStamp: formattedTs};
      newRewards = JSON.stringify(newRewards);
      await storeNewSend(sendsJsonStr, delegationsJsonStr, newSuccessFail, newRewards);

      //reset counters
      rtTenMinSend = 0;
      rtTenMinDelegation = 0;
      rtSuccessCount = 0;
      rtFailCount = 0;
      rtTenMinRewards = 0;
              
      //add current block data to counters
      rtSuccessCount += rtBlockData.tSuccessCount;
      rtFailCount += rtBlockData.tFailCount;
      rtTenMinSend += rtBlockData.sends;
      rtTenMinDelegation += rtBlockData.delegations;
      rtTenMinRewards += rtBlockData.rewards;

      rtEntryTime = rtCurrentTs; //records the beginning timestamp of the next 10 minute interval
      rtPreviousTs = rtCurrentTs;
      rtBlockHeight++;
      fetchRtDataRetry = true;
      fetchRtTimeStampRetry = true;
    }
    else{
      rtTenMinSend += rtBlockData.sends;
      rtTenMinDelegation += rtBlockData.delegations;
      rtSuccessCount += rtBlockData.tSuccessCount;
      rtFailCount += rtBlockData.tFailCount;
      rtTenMinRewards += rtBlockData.rewards;

      rtBlockHeight++; 
      rtPreviousTs = rtCurrentTs;
      fetchRtDataRetry = true;
      fetchRtTimeStampRetry = true;
    }
  }
}


 //Main function for historical data
async function historicalQuery()
{
  let firstInterval = true;
  let length = await client.lLen('sends_data');

  while(length<4030) { //function stops when 1 month of data is collected
    length = await client.lLen('sends_data');
    while (hsPreviousTs == null) {//timestamp of realTimeQuerys first block
      await delay(1000);
    }
    
    while (fetchHsDataRetry == true) { //retry logic for getHistoricalData
      await getHistoricalData();
      if (fetchHsDataRetry == true) {
        await delay(5000);
      }
    }

    while (fetchHsTimeStampRetry == true) { //retry logic for getHistoricalBlockTime
      hsCurrentTs = await getHistoricalBlockTime(hsBlockHeight);
      if (fetchHsTimeStampRetry == true) {
        await delay(5000);
      }
    }

    if(hsCurrentTs.substring(15,16)=='9' && hsPreviousTs.substring(15,16)!=hsCurrentTs.substring(15,16)) {//find the end of the 10 minute interval
      if(firstInterval == true) {//end of first 10 minute interval

        hsTenMinSend += hsBlockData.sends;
        hsTenMinDelegation += hsBlockData.delegations;
        hsSuccessCount += hsBlockData.tSuccessCount;
        hsFailCount += hsBlockData.tFailCount;
        hsTenMinRewards += hsBlockData.rewards;
        hsBlockHeight--;
        fetchHsDataRetry = true;
        fetchHsTimeStampRetry = true;

        rtEntryTime= hsPreviousTs.substring(0,11) + " " + hsPreviousTs.substring(11,17);//sets rtEntryTime allowing realTimeQuery to finalize the first 10 minute interval once it reaches the end.
        firstInterval = false;
      }
      else {

      //send currunt counts to redis excluding current block
      let formattedTs = hsPreviousTs.substring(0,11) + " " + hsPreviousTs.substring(11,17);
      hsTenMinSend = formatToBLD(hsTenMinSend);
      let oldSendsJsonStr = {value: hsTenMinSend, timeStamp: formattedTs};
      oldSendsJsonStr = JSON.stringify(oldSendsJsonStr);
      hsTenMinDelegation = formatToBLD(hsTenMinDelegation);
      let oldDelegationJsonStr = {value: hsTenMinDelegation, timeStamp: formattedTs};
      oldDelegationJsonStr = JSON.stringify(oldDelegationJsonStr);
      let oldSuccessFail = {success: hsSuccessCount, fail: hsFailCount, timeStamp: formattedTs};
      oldSuccessFail = JSON.stringify(oldSuccessFail);
      hsTenMinRewards = formatToBLD(hsTenMinRewards);
      let oldRewards = {value: hsTenMinRewards, timeStamp: formattedTs};
      oldRewards = JSON.stringify(oldRewards);
      await storeOldSend(oldSendsJsonStr, oldDelegationJsonStr, oldSuccessFail, oldRewards);

      //reset counters
      hsTenMinSend = 0;
      hsTenMinDelegation = 0;
      hsSuccessCount = 0;
      hsFailCount = 0;
      hsTenMinRewards = 0;

      //add current block data to counters
      hsTenMinSend += hsBlockData.sends;
      hsTenMinDelegation += hsBlockData.delegations;
      hsSuccessCount = hsBlockData.tSuccessCount;
      hsFailCount = hsBlockData.tFailCount;
      hsTenMinRewards = hsBlockData.rewards;
      hsBlockHeight--;
      fetchHsDataRetry = true;
      fetchHsTimeStampRetry = true;

      length = await client.lLen('sends_data');
      }
    }
    else {
      if(firstInterval == true) {//hasn't reached the end of the first 10 min interval(historicalQuery adds to realTimeQuery counters)
        rtTenMinSend += hsBlockData.sends;
        rtTenMinDelegation += hsBlockData.delegations;
        rtSuccessCount += hsBlockData.tSuccessCount;
        rtFailCount += hsBlockData.tFailCount;
        rtTenMinRewards += hsBlockData.rewards;
        hsBlockHeight--;
        fetchHsDataRetry = true;
        fetchHsTimeStampRetry = true;
      }
      else{
        hsTenMinSend += hsBlockData.sends;
        hsTenMinDelegation += hsBlockData.delegations;
        hsSuccessCount += hsBlockData.tSuccessCount;
        hsFailCount += hsBlockData.tFailCount;
        hsTenMinRewards += hsBlockData.rewards;
        hsBlockHeight--;
        fetchHsDataRetry = true;
        fetchHsTimeStampRetry = true;
      }
    }
    hsPreviousTs=hsCurrentTs;
  }
}


//gets timeStamp of a block for realTimeQuery
async function getRealTimeBlockTime(blockHeight) {
  return await new Promise((resolve, reject) => {
    https.get('http://65.109.34.121:36657/block?height=' + blockHeight, (resp) => {
      let data = '';

      resp.on('data', (chunk) => {
        data += chunk;
      });

      resp.on('end', () => {
        let jsonBlock = JSON.parse(data);
        if (jsonBlock.error ||
            !jsonBlock.result ||
            !jsonBlock.result.block ||
            !jsonBlock.result.block.header ||
            !jsonBlock.result.block.header.time) {
          resolve(null);
        } else {
          let time = jsonBlock.result.block.header.time;
          time = time.split('.')[0];
          fetchRtTimeStampRetry = false;
          resolve(time);
        }
      });
    }).on('error', (err) => {
      resolve(null);
    });
  });
}

//gets timeStamp of a block for HistoricalQuery (two getBlockTime function are required for retry logic)
async function getHistoricalBlockTime(blockHeight) {
  return await new Promise((resolve, reject) => {
    https.get('http://65.109.34.121:36657/block?height=' + blockHeight, (resp) => {
      let data = '';

      resp.on('data', (chunk) => {
        data += chunk;
      });

      resp.on('end', () => {
        let jsonBlock = JSON.parse(data);
        if (jsonBlock.error ||
            !jsonBlock.result ||
            !jsonBlock.result.block ||
            !jsonBlock.result.block.header ||
            !jsonBlock.result.block.header.time) {
          resolve(null);
        } else {
          let time = jsonBlock.result.block.header.time;
          time = time.split('.')[0];
          fetchHsTimeStampRetry = false;
          resolve(time);
        }
      });
    }).on('error', (err) => {
      resolve(null);
    });
  });
}


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// API call function used by historicalQuery to fetch data for a specific block height (hsBlockHeight)
async function getHistoricalData()
{
  await new Promise((resolve, reject) => {
  https.get(`http://65.109.34.121:36657/block_results?height=${hsBlockHeight}`, (res) => {
    let bData = '';

    res.on('data', (chunk) => {
      bData += chunk;
    });

    res.on('end', () => {
      const data = JSON.parse(bData);

      // Retry if there's a specific error in the response
      if (!data.error) {
        hsBlockData = findData(data);
        fetchHsDataRetry = false;
      }
      resolve();
    });
  }).on('error', (err) => {
    resolve(); // Reject the promise if there's an error
  });
})}

// API call function used by realTimeQuery to fetch data for the latest block height (rtBlockHeight)
async function getRealTimeData()
{
  await new Promise((resolve, reject) => {
    https.get(`http://65.109.34.121:36657/block_results?height=${rtBlockHeight}`, (res) => {
      let bData = '';
  
      res.on('data', (chunk) => {
        bData += chunk;
      });
  
      res.on('end', () => {
        const data = JSON.parse(bData);

        if (!data.error) {
          rtBlockData = findData(data);
          fetchRtDataRetry = false;
        }
        resolve();
      });
    }).on('error', (err) => {
      resolve(); // Reject the promise if there's an error
    });
  })
}

//map for fetching parameter data
const queryMap = {
  minting: {
    url: `https://main.api.agoric.net/cosmos/mint/v1beta1/params`,
    extract: (data) => ({
      mintDenom: data.params.mint_denom,
      inflationRateChange: data.params.inflation_rate_change,
      inflationMax: data.params.inflation_max,
      inflationMin: data.params.inflation_min,
      goalBonded: data.params.goal_bonded,
      blocksPerYear: data.params.blocks_per_year
    })
  },
  staking: {
    url: `https://main.api.agoric.net/cosmos/staking/v1beta1/params`,
    extract: (data) => ({
      unbondingTime: data.params.unbonding_time,
      maxValidators: data.params.max_validators,
      maxEntries: data.params.max_entries,
      historicalEntries: data.params.historical_entries,
      bondDenom: data.params.bond_denom
    })
  },
  distribution: {
    url: `https://main.api.agoric.net/cosmos/distribution/v1beta1/params`,
    extract: (data) => ({
      communityTax: data.params.community_tax,
      baseProposerReward: data.params.base_proposer_reward,
      bonusProposerReward: data.params.bonus_proposer_reward,
      withdrawAddrEnabled: data.params.withdraw_addr_enabled
    })
  },
  slashing: {
    url: `https://main.api.agoric.net/cosmos/slashing/v1beta1/params`,
    extract: (data) => ({
      signedBlocksWindow: data.params.signed_blocks_window,
      minSignedPerWindow: data.params.min_signed_per_window,
      downtimeJailDuration: data.params.downtime_jail_duration,
      slashFractionDoubleSign: data.params.slash_fraction_double_sign,
      slashFractionDowntime: data.params.slash_fraction_downtime
    })
  },
  govVoting: {
    url: `https://main.api.agoric.net/cosmos/gov/v1beta1/params/voting`,
    extract: (data) => ({
      votingPeriod: data.voting_params.voting_period
    })
  },
  govDeposit: {
    url: `https://main.api.agoric.net/cosmos/gov/v1beta1/params/deposit`,
    extract: (data) => ({
      minDeposit: data.deposit_params.min_deposit[0],
      maxDepositPeriod: data.deposit_params.max_deposit_period
    })
  },
  govTallying: {
    url: `https://main.api.agoric.net/cosmos/gov/v1beta1/params/tallying`,
    extract: (data) => ({
      quorum: data.tally_params.quorum,
      threshold: data.tally_params.threshold,
      vetoThreshold: data.tally_params.veto_threshold
    })
  },
  versionInfo: {
    url: `https://main.api.agoric.net/cosmos/base/tendermint/v1beta1/node_info`,
    extract: (data) => ({
      sdkVersion: data.application_version.cosmos_sdk_version,
      binaryVersion: data.application_version.version
    })
  }
};

//function to fetch data from a given URL (used by queryMap to retrieve parameter data)
function fetchParamData(fullUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(fullUrl);
    const lib = parsedUrl.protocol === 'https:' ? httpsReal : http;

    const req = lib.get(parsedUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(`Failed to parse JSON: ${err.message}`);
        }
      });
    });

    req.on('error', (err) => reject(`Request error: ${err.message}`));
  });
}
//fetches all on-chain module parameters defined in queryMap and stores in redis
async function getAllChainParams() {
  const results = {};

  for (const [key, { url, extract }] of Object.entries(queryMap)) {
    try {
      const data = await fetchParamData(url);
      results[key] = extract(data);
    } catch (err) {
      console.error(`[ERROR] ${key}: ${err}`);
      results[key] = null;
    }
  }

  await client.set('param_data', JSON.stringify(results));


}
//gets the running count for the most recent ten minute interval
function getNewestEntry(){
  if(!rtEntryTime){
    return null;
  }
  let ts = rtEntryTime.substring(0,11) + " " + rtEntryTime.substring(11,17);

  let sendsEntry = {value: formatToBLD(rtTenMinSend), timeStamp: ts};
  let delegationsEntry = {value: formatToBLD(rtTenMinDelegation), timeStamp: ts};
  let successFailEntry = {success: rtSuccessCount, fail: rtFailCount, timeStamp: ts};
  let rewardsEntry = {value: formatToBLD(rtTenMinRewards), timeStamp: ts};
  let NewestEntry= {sendsEntry, delegationsEntry, successFailEntry, rewardsEntry};

  return NewestEntry;
}

async function start()//upon start, clears redis and starts main functions
{
  await client.lTrim('sends_data', 1, 0);
  await client.lTrim('delegation_data', 1, 0);
  await client.lTrim('success/fail_data', 1, 0);
  await client.lTrim('rewards_data', 1, 0);
  await delay(10000);
  realTimeQuery();
  historicalQuery();
  getAllChainParams();
  setInterval(getAllChainParams,24 * 60 * 60 * 1000);//once per day

}

///function used to convert UBLD to BLD
function formatToBLD(uBLD){
  return (uBLD / 1000000).toFixed(2);
}


module.exports = getNewestEntry;
