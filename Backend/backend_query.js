const https = require('http');
const httpsReal = require('https');
const client = require('./redis');
const { timeStamp } = require('console');

//real time variables
let successCount = 0;
let failCount = 0;
let recentBlockData= {sends: 0, delegations: 0, tSuccessCount : 0, tFailCount: 0, rewards: 0};
let tenMinSend = 0;
let tenMinDelegation = 0;
let tenMinRewards = 0;
let realTimeTs;
let mostRecentBlock;
let startTime = null;
let success = false;

//historical variables
let revSuccessCount = 0;
let revFailCount = 0;
let oldBlockData = {sends: 0, delegations: 0, tSuccessCount :0, tFailCount: 0, rewards: 0};
let revTenMinSend = 0;
let revTenMinDelegation = 0;
let revTenMinRewards = 0;
let reverseBlock;
let lastTs;
let Ts;


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
  if(jsonBlock.result.begin_block_events != undefined)
  {
  while(jsonBlock.result.begin_block_events[k] != undefined)
  {
    if(jsonBlock.result.begin_block_events[k].type == 'rewards' && ((jsonBlock.result.begin_block_events[k].attributes[0].value!= null ||jsonBlock.result.begin_block_events[k].attributes[0].value!= undefined)&&jsonBlock.result.begin_block_events[k].attributes[0]!=undefined ))
    {
      let base64Reward = jsonBlock.result.begin_block_events[k].attributes[0].value;
      let decodedBufferReward = Buffer.from(base64Reward, 'base64');
      let decodedReward = decodedBufferReward.toString('utf8');
      decodedReward = decodedReward.substring(0,decodedReward.length - 4);
      decodedReward = Number(decodedReward);
      decodedReward = Math.floor(decodedReward);
      if(!isNaN(decodedReward))
        {
        blockRewards+=decodedReward;
        }
    }
    k++;
  }
}
  //no transaction
  if(jsonBlock.result.txs_results==undefined || jsonBlock.result.txs_results==null)
  {
    let dataObject = {sends: blockSends, delegations: blockDelegations, tSuccessCount: success, tFailCount: fail};
    return dataObject;
  }
  let tx_results = jsonBlock.result.txs_results;
  let i = 0;
  while(tx_results[i]!=undefined||tx_results[i]!=null)
  {
    for(let j=0;j<tx_results[i].events.length;j++)
    {
      //delegations
      if((tx_results[i].events[j].type == 'delegate') && (tx_results[i].events[j].attributes[1]!=undefined&&tx_results[i].events[j].attributes[1]!=null))
      {
        let base64Delegation = tx_results[i].events[j].attributes[1].value;
        let decodedBufferDelegation = Buffer.from(base64Delegation, 'base64');
        let decodedDelegation = decodedBufferDelegation.toString('utf8');
        decodedDelegation = decodedDelegation.substring(0,decodedDelegation.length - 4);
        decodedDelegation = Number(decodedDelegation);
        if(!isNaN(decodedDelegation))
        {
        blockDelegations+=decodedDelegation;
        }
      }
      //sends
      if((tx_results[i].events[j].type == 'transfer') && (tx_results[i].events[j].attributes[2]!=undefined&&tx_results[i].events[j].attributes[2]!=null))
      {
        let base64Transfer = tx_results[i].events[j].attributes[2].value;
        let decodedBufferTransfer = Buffer.from(base64Transfer, 'base64');
        let decodedTransfer = decodedBufferTransfer.toString('utf8');
        decodedTransfer = decodedTransfer.substring(0,decodedTransfer.length - 4);
        decodedTransfer = Number(decodedTransfer);
        if(!isNaN(decodedTransfer))
        {
        blockSends+=decodedTransfer;
        }
      }
    }
    //success/fail
    if(tx_results[i].code == 0)
    {
      success++;
    }
    else
    {
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
  if (length>4030)
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
The realTimeQuery function and historicalQuery work together for the first 10 minute interval of data and diverge after. 
For the first 10 minute interval, realTimeQuery and historicalQuery share the same counters(sends, delegations, success/fail, rewards). 
RealTimeQuery moves forward and historicalQuery moves backwards. Once historicalQuery reaches it's end of the 10 minute interval it starts using it's own sum from then on immedietly.
If realtimeQuery reaches its end of the chunk before historicalQuery it waits for historicalQuery to reach it's end of the chunk before sending the data to redis and moving onto the next chunk.
This ensures the first 10 minute chunk of data is accurate.
*/




async function realTimeQuery() { //Main function for getting real time data
  let firstBlock = false;
  mostRecentBlock = await getLatestBlock();
  let lastRealtimeTs = await getBlockTime(mostRecentBlock-1);
  reverseBlock= mostRecentBlock-1;
  while (true) {
            await getRealTimeData()
            if(success==true)
            {
            realTimeTs = await getBlockTime(mostRecentBlock);
            if(firstBlock==false)
            {
            lastTs=realTimeTs;
            firstBlock = true;
            }
            if(realTimeTs.substring(15,16)=='0' && lastRealtimeTs.substring(15,16)!=realTimeTs.substring(15,16)) //finds the end of the 10 minute interval
            {
              while(startTime==null)//waits for historicalQuery to reach the end of the first interval before finalizing the first 10 minute interval
              {
                await delay(1000);
              }
              //format and store in redis excluding current block
              let formattedTs = startTime.substring(0,11) + " " + startTime.substring(11,17);
              tenMinSend = formatToBLD(tenMinSend);
              let sendsJsonStr = {value: tenMinSend, timeStamp: formattedTs};
              sendsJsonStr = JSON.stringify(sendsJsonStr);
              tenMinDelegation = formatToBLD(tenMinDelegation);
              let delegationsJsonStr = {value: tenMinDelegation, timeStamp: formattedTs};
              delegationsJsonStr= JSON.stringify(delegationsJsonStr);
              let newSuccessFail = {success: successCount, fail: failCount, timeStamp: formattedTs};
              newSuccessFail = JSON.stringify(newSuccessFail);
              tenMinRewards = formatToBLD(tenMinRewards);
              let newRewards = {value: tenMinRewards, timeStamp: formattedTs};
              newRewards = JSON.stringify(newRewards);
              await storeNewSend(sendsJsonStr, delegationsJsonStr, newSuccessFail, newRewards);

              //reset counters
              tenMinSend=0;
              tenMinDelegation=0;
              successCount=0;
              failCount=0;
              tenMinRewards=0;
              
              //add current block data to counters
              successCount+=recentBlockData.tSuccessCount;
              failCount+=recentBlockData.tFailCount;
              tenMinSend+=recentBlockData.sends;
              tenMinDelegation+=recentBlockData.delegations;
              tenMinRewards+=recentBlockData.rewards;

              startTime=realTimeTs;
              lastRealtimeTs=realTimeTs;
              mostRecentBlock++;
              success=false;
              }else{
                tenMinSend+=recentBlockData.sends;
                tenMinDelegation+=recentBlockData.delegations;
                successCount+=recentBlockData.tSuccessCount;
                failCount+=recentBlockData.tFailCount;
                tenMinRewards+=recentBlockData.rewards;

                mostRecentBlock++; 
                lastRealtimeTs=realTimeTs;
                success=false;
              }}
              await delay(5000);
          }
      }



async function historicalQuery() //Main function for getting historical data
{
  let firstInterval = true;
  let formattedTs;
  let length = await client.lLen('sends_data');

  while(length<4030)
  {
    length = await client.lLen('sends_data');
    while (lastTs==null)//timestamp of realTimeQuerys first block
    {
      await delay(1000);
    }
    Ts = await getBlockTime(reverseBlock);
    if (Ts == null)
    {
      continue;
    }
    await getHistoricalData();

    if(Ts.substring(15,16)=='9' && lastTs.substring(15,16)!=Ts.substring(15,16))//find the end of the 10 minute interval
    {
      if(firstInterval == true)//end of first 10 minute interval
      {

        revTenMinSend+=oldBlockData.sends;
        revTenMinDelegation+=oldBlockData.delegations;
        revSuccessCount+=oldBlockData.tSuccessCount;
        revFailCount+=oldBlockData.tFailCount;
        revTenMinRewards+=oldBlockData.rewards;

        startTime= lastTs.substring(0,11) + " " + lastTs.substring(11,17);//sets startTime allowing realTimeQuery to finalize the first 10 minute interval once it reaches the end.
        firstInterval = false;
      }
      else
      {
      //send currunt counts to redis excluding current block
      formattedTs = lastTs.substring(0,11) + " " + lastTs.substring(11,17);
      revTenMinSend = formatToBLD(revTenMinSend);
      let oldSendsJsonStr = {value: revTenMinSend, timeStamp: formattedTs};
      oldSendsJsonStr = JSON.stringify(oldSendsJsonStr);
      revTenMinDelegation = formatToBLD(revTenMinDelegation);
      let oldDelegationJsonStr = {value: revTenMinDelegation, timeStamp: formattedTs};
      oldDelegationJsonStr = JSON.stringify(oldDelegationJsonStr);
      let oldSuccessFail = {success: revSuccessCount, fail: revFailCount, timeStamp: formattedTs};
      oldSuccessFail = JSON.stringify(oldSuccessFail);
      revTenMinRewards = formatToBLD(revTenMinRewards);
      let oldRewards = {value: revTenMinRewards, timeStamp: formattedTs};
      oldRewards = JSON.stringify(oldRewards);
      await storeOldSend(oldSendsJsonStr, oldDelegationJsonStr, oldSuccessFail, oldRewards);

      //reset counters
      revTenMinSend=0;
      revTenMinDelegation=0;
      revSuccessCount = 0;
      revFailCount = 0;
      revTenMinRewards = 0;

      //add current block data to counters
      revTenMinSend+=oldBlockData.sends;
      revTenMinDelegation+=oldBlockData.delegations;
      revSuccessCount = oldBlockData.tSuccessCount;
      revFailCount = oldBlockData.tFailCount;
      revTenMinRewards = oldBlockData.rewards;

      length = await client.lLen('sends_data');
      }
    }
    else
    {
      if(firstInterval == true)//hasn't reached the end of the first 10 min interval
      {
        tenMinSend+=oldBlockData.sends;
        tenMinDelegation+=oldBlockData.delegations;
        successCount+=oldBlockData.tSuccessCount;
        failCount+=oldBlockData.tFailCount;
        tenMinRewards+=oldBlockData.rewards
      }
      else{
        revTenMinSend+=oldBlockData.sends;
        revTenMinDelegation+=oldBlockData.delegations;
        revSuccessCount+=oldBlockData.tSuccessCount;
        revFailCount+=oldBlockData.tFailCount;
        revTenMinRewards+=oldBlockData.rewards;
      }
    }
    lastTs=Ts;
  }
}


//gets timeStamp of a block
async function getBlockTime(blockHeight)
{
  return await new Promise((resolve,reject) => {
  https.get('http://65.109.34.121:36657/block?height='+ blockHeight, (resp) => {
    let data = '';
  
    resp.on('data', (chunk) =>  {
      data += chunk;
    });
  
    resp.on('end', () => {
      let jsonBlock = JSON.parse(data);
      if(jsonBlock.error)
      {
        resolve(null);
      }
      else{

      let time = jsonBlock.result.block.header.time;
      time = time.split('.')[0];
      resolve(time);
      }
    })
  })
})}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// API call function used by historicalQuery to fetch data for a specific block height (reverseBlock)
async function getHistoricalData()
{
  
  await new Promise((resolve, reject) => {
  https.get(`http://65.109.34.121:36657/block_results?height=${reverseBlock}`, (res) => {
    let bData = '';

    res.on('data', (chunk) => {
      bData += chunk;
    });

    res.on('end', () => {
      const data = JSON.parse(bData);

      // Retry if there's a specific error in the response
      if (data.error) {


        if (data.error.code === -32603 && data.error.data.includes('could not find results for height')) {

        }else if (data.error.code === -32603 && data.error.data.includes('must be less than or equal to the current blockchain height')) {

        }
      } else {
        if (data.result.txs_results != null) {
          oldBlockData = findData(data);
        }
        reverseBlock--;
      }
      resolve();
    });
  }).on('error', (err) => {

    reject(err); // Reject the promise if there's an error
  });
})}

// API call function used by realTimeQuery to fetch data for the latest block height (mostRecentBlock)
async function getRealTimeData()
{

  await new Promise((resolve, reject) => {
    https.get(`http://65.109.34.121:36657/block_results?height=${mostRecentBlock}`, (res) => {
      let bData = '';
  
      res.on('data', (chunk) => {
        bData += chunk;
      });
  
      res.on('end', () => {
        const data = JSON.parse(bData);

        if (data.error) {

  
          if (data.error.code === -32603 && data.error.data.includes('could not find results for height')) {

          }else if (data.error.code === -32603 && data.error.data.includes('must be less than or equal to the current blockchain height')) {

          }
        } else {
          if (data.result.txs_results != null) {
            recentBlockData = findData(data);
            success=true;
          }
          success=true;
        }
        resolve();
      });
    }).on('error', (err) => {

      reject(err); // Reject the promise if there's an error
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
  if(!startTime){
    return null;
  }
  let ts = startTime.substring(0,11) + " " + startTime.substring(11,17);

  let sendsEntry = {value: formatToBLD(tenMinSend), timeStamp: ts};
  let delegationsEntry = {value: formatToBLD(tenMinDelegation), timeStamp: ts};
  let successFailEntry = {success: successCount, fail: failCount, timeStamp: ts};
  let rewardsEntry = {value: formatToBLD(tenMinRewards), timeStamp: ts};
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
