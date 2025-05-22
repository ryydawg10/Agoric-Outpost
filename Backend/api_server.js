require('dotenv').config();

const express = require('express');
const client = require('./redis');
const path = require('path');
const getRunningSum = require('./backend_query');


const app = express();
app.use(express.static(path.join(__dirname,'..', 'Frontend')));
const PORT = process.env.PORT || 8080;





//4hr timeframe
app.get('/api/4hr/fullLoad', async (req,res)=> {
  const listLength = await getListLength('sends_data');
  let fourHrData;
  let tempTimeStamp;
  if(listLength<23) //one entry is left open for newest entry
  {
    fourHrData = await getData(listLength);
  } else {
    fourHrData = await getData(23);
  }
  if(!fourHrData) // Return 404 if Redis has no stored data yet (prevents crash on empty DB)
  {
    return res.status(404).json({ error: 'No data found' });
  }
  let newestEntry = getRunningSum();
  fourHrData = addNewestEntry(fourHrData, newestEntry);
  
  for(let i = 0;i<fourHrData.sends.length;i++)
  {
    nullChecker(fourHrData, i);//replaces any null entries with 0
    tempTimeStamp = fourHrData.sends[i].timeStamp;
    if (tempTimeStamp.charAt(12) === ' ') {  //timestamp formatting
      tempTimeStamp = tempTimeStamp.substring(0, 12) + tempTimeStamp.substring(13);
      tempTimeStamp = tempTimeStamp + ' - ' + tempTimeStamp.substring(tempTimeStamp.length-5, tempTimeStamp.length-1) + '9';
    }
    else{
      tempTimeStamp = tempTimeStamp.substring(0, tempTimeStamp.length-1);
      tempTimeStamp = tempTimeStamp + ' - ' + tempTimeStamp.substring(tempTimeStamp.length-5, tempTimeStamp.length-1) + '9';
    }
    fourHrData.sends[i].timeStamp = tempTimeStamp;
    fourHrData.delegations[i].timeStamp = tempTimeStamp;
    fourHrData.successFail[i].timeStamp = tempTimeStamp;
    fourHrData.rewards[i].timeStamp = tempTimeStamp;
  }

  res.json({fourHrData});
})

//1day timeframe
app.get('/api/1day/fullLoad', async (req,res)=> {
  const listLength = await getListLength('sends_data');
  let oneDayData;

  let sendsArray = [];
  let delegationsArray = [];
  let successFailArray = [];
  let rewardsArray = [];

  let oneHourSendsSum = 0;
  let oneHourDelegationsSum = 0;
  let oneHourSuccessSum = 0;
  let oneHourFailSum= 0;
  let oneHourRewardsSum = 0;

  let tempTimeStamp;
  let count = 0;
  if(listLength<143)
  {
    oneDayData = await getData(listLength);
  } else {
    oneDayData = await getData(143);
  }
  if(!oneDayData)
  {
    return res.status(404).json({ error: 'No data found' });
  }
  let newestEntry = getRunningSum();
  oneDayData = addNewestEntry(oneDayData,newestEntry);
  for(let i = 0;i<oneDayData.sends.length-1;i++)
  {
    if(count == 24)
    {
      break;
    }
    nullChecker(oneDayData, i);
    tempTimeStamp = oneDayData.sends[i].timeStamp;
    if(tempTimeStamp.substring(15,17)=='00')//loops through data until an even hour point is found
    {
      oneHourSendsSum+=parseFloat(oneDayData.sends[i].value);
      oneHourDelegationsSum+=parseFloat(oneDayData.delegations[i].value);
      oneHourSuccessSum+=oneDayData.successFail[i].success;
      oneHourFailSum+=oneDayData.successFail[i].fail;
      oneHourRewardsSum+=parseFloat(oneDayData.rewards[i].value);

      tempTimeStamp = formatTimeStamp(tempTimeStamp);
      let oneHourSendsEntry = {value: oneHourSendsSum.toFixed(2), timeStamp: tempTimeStamp};
      let oneHourDelegationsEntry = {value: oneHourDelegationsSum.toFixed(2), timeStamp: tempTimeStamp};
      let oneHourSuccessFailEntry = {success: oneHourSuccessSum, fail: oneHourFailSum, timeStamp: tempTimeStamp};
      let oneHourRewardsEntry = {value: oneHourRewardsSum.toFixed(2), timeStamp: tempTimeStamp};

      sendsArray.push(oneHourSendsEntry);
      delegationsArray.push(oneHourDelegationsEntry);
      successFailArray.push(oneHourSuccessFailEntry);
      rewardsArray.push(oneHourRewardsEntry);

      oneHourSendsSum=0;
      oneHourDelegationsSum=0;
      oneHourSuccessSum=0;
      oneHourFailSum=0;
      oneHourRewardsSum=0;

      count++
    }
    else{
      oneHourSendsSum+=parseFloat(oneDayData.sends[i].value);
      oneHourDelegationsSum+=parseFloat(oneDayData.delegations[i].value);
      oneHourSuccessSum+=oneDayData.successFail[i].success;
      oneHourFailSum+=oneDayData.successFail[i].fail;
      oneHourRewardsSum+=parseFloat(oneDayData.rewards[i].value);
    }
    
    
  }
  let formattedOneDayData = {sends: sendsArray, delegations: delegationsArray, successFail: successFailArray, rewards: rewardsArray};

  res.json({formattedOneDayData});
})

//4day timeframe
app.get('/api/4day/fullLoad', async (req,res)=> {
  const listLength = await getListLength('sends_data');
  let fourDayData;

  let sendsArray = [];
  let delegationsArray = [];
  let successFailArray = [];
  let rewardsArray = [];

  let fourHourSendsSum = 0;
  let fourHourDelegationsSum = 0;
  let fourHourSuccessSum = 0;
  let fourHourFailSum = 0;
  let fourHourRewardsSum = 0;

  let tempTimeStamp;
  let endTimeStamp;
  let count = 0;
  
  if(listLength<575)
  {
    fourDayData = await getData(listLength);
  } else {
    fourDayData = await getData(575);
  }
  if(!fourDayData)
  {
    return res.status(404).json({ error: 'No data found' });
  }
  let newestEntry = getRunningSum();
  fourDayData = addNewestEntry(fourDayData,newestEntry);
  for(let i = 0;i<fourDayData.sends.length-1;i++)
  {
    if(count == 24)
    {
      break;
    }
    nullChecker(fourDayData, i);
    tempTimeStamp = fourDayData.sends[i].timeStamp;
    if(tempTimeStamp.substring(15,17)=='00')
    {
      hourDigits = tempTimeStamp.substring(12,14);
      hourDigits = parseInt(hourDigits, 10);
      if(hourDigits%4==0) //loops through data until an even 4hr point is found
      {
        tempTimeStamp = tempTimeStamp.substring(0,17);
        hourDigits+=3;
        if(hourDigits.toString().length == 1)
        {
          endTimeStamp = ' - 0' + hourDigits + ':59';
          tempTimeStamp = tempTimeStamp+endTimeStamp;
        }
        else{
          endTimeStamp = ' - ' + hourDigits + ':59';
          tempTimeStamp = tempTimeStamp+endTimeStamp;
        }

        fourHourSendsSum+=parseFloat(fourDayData.sends[i].value);
        fourHourDelegationsSum+=parseFloat(fourDayData.sends[i].value);
        fourHourSuccessSum+=fourDayData.successFail[i].success;
        fourHourFailSum+=fourDayData.successFail[i].fail;
        fourHourRewardsSum+=parseFloat(fourDayData.rewards[i].value);

        let fourDaySendsEntry = {value : fourHourSendsSum.toFixed(2), timeStamp : tempTimeStamp}
        let fourDayDelegationsEntry = {value: fourHourDelegationsSum.toFixed(2), timeStamp : tempTimeStamp}
        let fourDaySuccessFailEntry = {success: fourHourSuccessSum, fail: fourHourFailSum, timeStamp: tempTimeStamp};
        let fourDayRewardsEntry = {value: fourHourRewardsSum.toFixed(2), timeStamp: tempTimeStamp};

        sendsArray.push(fourDaySendsEntry);
        delegationsArray.push(fourDayDelegationsEntry);
        successFailArray.push(fourDaySuccessFailEntry);
        rewardsArray.push(fourDayRewardsEntry);

        fourHourSendsSum = 0;
        fourHourDelegationsSum = 0;
        fourHourSuccessSum = 0;
        fourHourFailSum = 0;
        fourHourRewardsSum = 0;

        count++;

      }
      else{
        fourHourSendsSum+=parseFloat(fourDayData.sends[i].value);
        fourHourDelegationsSum+=parseFloat(fourDayData.delegations[i].value);
        fourHourSuccessSum+=fourDayData.successFail[i].success;
        fourHourFailSum+=fourDayData.successFail[i].fail;
        fourHourRewardsSum+=parseFloat(fourDayData.rewards[i].value);
      }
      
    }
    else{
      fourHourSendsSum+=parseFloat(fourDayData.sends[i].value);
      fourHourDelegationsSum+=parseFloat(fourDayData.delegations[i].value);
      fourHourSuccessSum+=fourDayData.successFail[i].success;
      fourHourFailSum+=fourDayData.successFail[i].fail;
      fourHourRewardsSum+=parseFloat(fourDayData.rewards[i].value);
    }
    
    
  }
  let formattedFourDayData = {sends: sendsArray, delegations: delegationsArray, successFail: successFailArray, rewards: rewardsArray};

  res.json({formattedFourDayData});
})

//8day timeframe
app.get('/api/8day/fullLoad', async (req,res)=> {
  const listLength = await getListLength('sends_data');
  let eightDayData;

  let sendsArray = [];
  let delegationsArray = [];
  let successFailArray = [];
  let rewardsArray = [];

  let eightHourSendsSum = 0;
  let eightHourDelegationsSum = 0;
  let eightHourSuccessSum = 0;
  let eightHourFailSum = 0;
  let eightHourRewardsSum = 0;

  let tempTimeStamp;
  let endTimeStamp;
  let count = 0;
  
  if(listLength<1151)
  {
    eightDayData = await getData(listLength);
  } else {
    eightDayData = await getData(1151);
  }
  if(!eightDayData)
  {
    return res.status(404).json({ error: 'No data found' });
  }
  let newestEntry = getRunningSum();
  eightDayData = addNewestEntry(eightDayData,newestEntry);
  for(let i = 0;i<eightDayData.sends.length-1;i++)
  {
    if(count == 24)
    {
      break;
    }
    nullChecker(eightDayData, i);
    tempTimeStamp = eightDayData.sends[i].timeStamp;
    if(tempTimeStamp.substring(15,17)=='00')
    {
      hourDigits = tempTimeStamp.substring(12,14);
      hourDigits = parseInt(hourDigits, 10);
      if(hourDigits%8==0) //loops through data until an even 8hr point is found
      {
        tempTimeStamp = tempTimeStamp.substring(0,17);
        hourDigits+=7;
        if(hourDigits.toString().length == 1)
        {
          endTimeStamp = ' - 0' + hourDigits + ':59';
          tempTimeStamp = tempTimeStamp+endTimeStamp;
        }
        else{
          endTimeStamp = ' - ' + hourDigits + ':59';
          tempTimeStamp = tempTimeStamp+endTimeStamp;
        }

        eightHourSendsSum+=parseFloat(eightDayData.sends[i].value);
        eightHourDelegationsSum+=parseFloat(eightDayData.sends[i].value);
        eightHourSuccessSum+=eightDayData.successFail[i].success;
        eightHourFailSum+=eightDayData.successFail[i].fail;
        eightHourRewardsSum+=parseFloat(eightDayData.rewards[i].value);

        let eightDaySendsEntry = {value : eightHourSendsSum.toFixed(2), timeStamp : tempTimeStamp}
        let eightDayDelegationsEntry = {value: eightHourDelegationsSum.toFixed(2), timeStamp : tempTimeStamp}
        let eightDaySuccessFailEntry = {success: eightHourSuccessSum, fail: eightHourFailSum, timeStamp: tempTimeStamp};
        let eightDayRewardsEntry = {value: eightHourRewardsSum.toFixed(2), timeStamp: tempTimeStamp};

        sendsArray.push(eightDaySendsEntry);
        delegationsArray.push(eightDayDelegationsEntry);
        successFailArray.push(eightDaySuccessFailEntry);
        rewardsArray.push(eightDayRewardsEntry);

        eightHourSendsSum = 0;
        eightHourDelegationsSum = 0;
        eightHourSuccessSum = 0;
        eightHourFailSum = 0;
        eightHourRewardsSum = 0;

        count++;

      }
      else{
        eightHourSendsSum+=parseFloat(eightDayData.sends[i].value);
        eightHourDelegationsSum+=parseFloat(eightDayData.delegations[i].value);
        eightHourSuccessSum+=eightDayData.successFail[i].success;
        eightHourFailSum+=eightDayData.successFail[i].fail;
        eightHourRewardsSum+=parseFloat(eightDayData.rewards[i].value);
      }
      
    }
    else{
      eightHourSendsSum+=parseFloat(eightDayData.sends[i].value);
      eightHourDelegationsSum+=parseFloat(eightDayData.delegations[i].value);
      eightHourSuccessSum+=eightDayData.successFail[i].success;
      eightHourFailSum+=eightDayData.successFail[i].fail;
      eightHourRewardsSum+=parseFloat(eightDayData.rewards[i].value);
    }
    
    
  }
  let formattedEightDayData = {sends: sendsArray, delegations: delegationsArray, successFail: successFailArray, rewards: rewardsArray};

  res.json({formattedEightDayData});
})

//15 day timeframe
app.get('/api/15day/fullLoad', async (req,res)=> {

  const listLength = await getListLength('sends_data');
  let fifteenDayData;

  let sendsArray = [];
  let delegationsArray = [];
  let successFailArray = [];
  let rewardsArray = [];

  let oneDaySendsSum = 0;
  let oneDayDelegationsSum = 0;
  let oneDaySuccessSum = 0;
  let oneDayFailSum = 0;
  let oneDayRewardsSum = 0;

  let tempTimeStamp;
  let count = 0;
  
  if(listLength<2159)
  {
    fifteenDayData = await getData(listLength);
  } else {
    fifteenDayData = await getData(2159);
  }
  if(!fifteenDayData)
  {
    return res.status(404).json({ error: 'No data found' });
  }
  let newestEntry = getRunningSum();
  fifteenDayData = addNewestEntry(fifteenDayData,newestEntry);
  for(let i = 0;i<fifteenDayData.sends.length-1;i++)
  {
    if(count==15)
    {
      break;
    }
    nullChecker(fifteenDayData, i);
    tempTimeStamp = fifteenDayData.sends[i].timeStamp;
    if(tempTimeStamp.substring(12,17)=='00:00') //loops through data until an even day point is found
    {
      tempTimeStamp = formatTimeStamp(tempTimeStamp);
      tempTimeStamp = tempTimeStamp.substring(0,17);
      tempTimeStamp = tempTimeStamp + ' - 23:59';

      oneDaySendsSum+= parseFloat(fifteenDayData.sends[i].value);
      oneDayDelegationsSum+= parseFloat(fifteenDayData.sends[i].value);
      oneDaySuccessSum+= fifteenDayData.successFail[i].success;
      oneDayFailSum+= fifteenDayData.successFail[i].fail;
      oneDayRewardsSum+= parseFloat(fifteenDayData.rewards[i].value);

      let fifteenDaySendsEntry = {value : oneDaySendsSum.toFixed(2), timeStamp : tempTimeStamp}
      let fifteenDayDelegationsEntry = {value: oneDayDelegationsSum.toFixed(2), timeStamp : tempTimeStamp}
      let fifteenDaySuccessFailEntry = {success: oneDaySuccessSum, fail: oneDayFailSum, timeStamp: tempTimeStamp};
      let fifteenDayRewardsEntry = {value: oneDayRewardsSum.toFixed(2), timeStamp: tempTimeStamp};

      sendsArray.push(fifteenDaySendsEntry);
      delegationsArray.push(fifteenDayDelegationsEntry);
      successFailArray.push(fifteenDaySuccessFailEntry);
      rewardsArray.push(fifteenDayRewardsEntry);

      oneDaySendsSum = 0;
      oneDayDelegationsSum = 0;
      oneDaySuccessSum = 0;
      oneDayFailSum = 0;
      oneDayRewardsSum = 0;

      count++;
    }
    else{
      oneDaySendsSum+=parseFloat(fifteenDayData.sends[i].value);
      oneDayDelegationsSum+=parseFloat(fifteenDayData.delegations[i].value);
      oneDaySuccessSum+=fifteenDayData.successFail[i].success;
      oneDayFailSum+=fifteenDayData.successFail[i].fail;
      oneDayRewardsSum+=parseFloat(fifteenDayData.rewards[i].value);
    }
  }
  let formattedFifteenDayData = {sends: sendsArray, delegations: delegationsArray, successFail: successFailArray, rewards: rewardsArray};

  res.json({formattedFifteenDayData});
})

//1month timeframe
app.get('/api/1month/fullLoad', async (req,res)=> {
  const listLength = await getListLength('sends_data');
  let oneMonthData;

  let sendsArray = [];
  let delegationsArray = [];
  let rewardsArray = [];
  let successFailArray = [];

  let oneDaySendsSum = 0;
  let oneDayDelegationsSum = 0;
  let oneDayRewardsSum = 0;
  let oneDaySuccessSum = 0;
  let oneDayFailSum = 0;

  let tempTimeStamp;
  let count = 0;
  
  if(listLength<4031)
  {
    oneMonthData = await getData(listLength);
  } else {
    oneMonthData = await getData(4031);
  }
  if(!oneMonthData)
  {
    return res.status(404).json({ error: 'No data found' });
  }
  let newestEntry = getRunningSum();
  oneMonthData = addNewestEntry(oneMonthData,newestEntry);
  for(let i = 0;i<oneMonthData.sends.length-1;i++)
  {
    if(count==28)
    {
      break;
    }
    nullChecker(oneMonthData, i);
    tempTimeStamp = oneMonthData.sends[i].timeStamp;
    if(tempTimeStamp.substring(12,17)=='00:00') //loops through data until an even day point is found
    {
      tempTimeStamp = formatTimeStamp(tempTimeStamp);
      tempTimeStamp = tempTimeStamp.substring(0,17);
      tempTimeStamp = tempTimeStamp + ' - 23:59';

      oneDaySendsSum+=parseFloat(oneMonthData.sends[i].value);
      oneDayDelegationsSum+=parseFloat(oneMonthData.delegations[i].value);
      oneDaySuccessSum+=oneMonthData.successFail[i].success;
      oneDayFailSum+=oneMonthData.successFail[i].fail;
      oneDayRewardsSum+=parseFloat(oneMonthData.rewards[i].value);

      let oneMonthSendsEntry = {value : oneDaySendsSum.toFixed(2), timeStamp : tempTimeStamp};
      let oneMonthDelegationsEntry = {value: oneDayDelegationsSum.toFixed(2), timeStamp : tempTimeStamp};
      let oneMonthSuccessFailEntry = {success: oneDaySuccessSum, fail: oneDayFailSum, timeStamp: tempTimeStamp};
      let oneMonthRewardsEntry = {value:oneDayRewardsSum.toFixed(2), timeStamp: tempTimeStamp};

      sendsArray.push(oneMonthSendsEntry);
      delegationsArray.push(oneMonthDelegationsEntry);
      rewardsArray.push(oneMonthRewardsEntry);
      successFailArray.push(oneMonthSuccessFailEntry);

      oneDaySendsSum = 0;
      oneDayDelegationsSum = 0;
      oneDaySuccessSum = 0;
      oneDayFailSum = 0;
      oneDayRewardsSum = 0;

      count++;
    }
    else{
      oneDaySendsSum+=parseFloat(oneMonthData.sends[i].value);
      oneDayDelegationsSum+=parseFloat(oneMonthData.delegations[i].value);
      oneDaySuccessSum+=oneMonthData.successFail[i].success;
      oneDayFailSum+=oneMonthData.successFail[i].fail;
      oneDayRewardsSum+=parseFloat(oneMonthData.rewards[i].value);
    }
  }
  let formattedOneMonthData = {sends: sendsArray, delegations: delegationsArray, successFail: successFailArray, rewards: rewardsArray};
  res.json({formattedOneMonthData});
})

//module parameters
app.get('/api/params', async (req,res)=> {
  let paramData = await client.get('param_data');
  if (!paramData) {
  return res.status(404).json({ error: 'No parameter data found' });
}
  paramData = JSON.parse(paramData);
  console.log(paramData);
  res.json({paramData});
})



app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Frontend', 'network-stats.html'));
});
// Start the server and listen for requests
app.listen(PORT, () => {
});

// gets (length) data points from redis
async function getData(length) {
  let sendData = await client.LRANGE('sends_data', 0, length-1);
  let delegationData = await client.LRANGE('delegation_data', 0, length-1);
  let successFailData = await client.LRANGE('success/fail_data', 0, length-1);
  let rewardsData = await client.LRANGE('rewards_data',0 , length-1);
  for (let i = 0;i<sendData.length;i++)
  {
    delegationData[i] = JSON.parse(delegationData[i]);
    sendData[i]= JSON.parse(sendData[i]);
    successFailData[i] = JSON.parse(successFailData[i]);
    rewardsData[i] = JSON.parse(rewardsData[i]);
  }
  dataObject = {sends: sendData, delegations: delegationData, successFail: successFailData, rewards: rewardsData};
  return dataObject;
}

// checks how many data points are in redis
async function getListLength(listName) {
  const length = await client.lLen(listName);
  return length;
}

//timestamp formatting function. used when applicable 
function formatTimeStamp(timeStamp) {
  if (timeStamp.charAt(12) === ' ') {
    timeStamp = timeStamp.substring(0, 12) + timeStamp.substring(13);
    timeStamp = timeStamp + ' - ' + timeStamp.substring(timeStamp.length-5,timeStamp.length-2) + '59';
  }
  else{
  timeStamp = timeStamp.substring(0,timeStamp.length-1);
  timeStamp = timeStamp + ' - ' + timeStamp.substring(timeStamp.length-5,timeStamp.length-2) + '59';
  }
  return timeStamp;
}

//null checker utility function
function nullChecker(data, index){
  if(data.sends[index].value==null || data.sends[index].value==undefined)
  {
    data.sends[index].value = 0;
  }
  if(data.delegations[index].value==null || data.delegations[index].value==undefined)
  {
    data.delegations[index].value = 0;
  }
  if(data.successFail[index].success==null || data.successFail[index].success==undefined)
  {
    data.successFail[index].success = 0;
  }
  if(data.successFail[index].fail == null|| data.successFail[index].fail==undefined)
  {
    data.successFail[index].fail = 0;
  }
  if(data.rewards[index].value == null || data.rewards[index].value == undefined)
  {
    data.rewards[index].value = 0;
  }
}

//adds most recent(incomplete) entry
function addNewestEntry(data,newestEntry){
  if(newestEntry)
  {
    data.sends.unshift(newestEntry.sendsEntry);
    data.delegations.unshift(newestEntry.delegationsEntry);
    data.successFail.unshift(newestEntry.successFailEntry);
    data.rewards.unshift(newestEntry.rewardsEntry);
  }
  return data;
}
