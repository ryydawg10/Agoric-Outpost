document.addEventListener('DOMContentLoaded', async function() {
    Load();
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('dropdown-menu').classList.toggle('hidden');
        document.getElementById('line').classList.toggle('hidden');
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth >= 800) {
          document.getElementById('dropdown-menu').classList.add('hidden');
          document.getElementById('line').classList.add('hidden');
        }
      });

})

async function Load() {
  const response = await fetch('/api/params');
  const { paramData } = await response.json();

    document.getElementById('mintDenom').textContent = paramData.minting.mintDenom.toUpperCase();
    document.getElementById('inflationRateChange').textContent = (parseFloat(paramData.minting.inflationRateChange) * 100).toFixed(0) + '%';
    document.getElementById('inflationMax').textContent = (parseFloat(paramData.minting.inflationMax) * 100).toFixed(1) + '%';
    document.getElementById('inflationMin').textContent = (parseFloat(paramData.minting.inflationMin) * 100).toFixed(1) + '%';
    document.getElementById('goalBonded').textContent = (parseFloat(paramData.minting.goalBonded) * 100).toFixed(1) + '%';
    document.getElementById('blocksPerYear').textContent = Number(paramData.minting.blocksPerYear).toLocaleString();

    // GOVERNANCE
    const deposit = paramData.govDeposit.minDeposit;
    const amountInBLD = (Number(deposit.amount) / 1_000_000).toFixed(2);
    document.getElementById('minDeposit').textContent = amountInBLD + ' BLD';
    document.getElementById('maxDepositPeriod').textContent = (parseInt(paramData.govDeposit.maxDepositPeriod) / 86400) + ' days';
    document.getElementById('quorum').textContent = (parseFloat(paramData.govTallying.quorum) * 100).toFixed(1) + '%';
    document.getElementById('threshold').textContent = (parseFloat(paramData.govTallying.threshold) * 100).toFixed(1) + '%';
    document.getElementById('vetoThreshold').textContent = (parseFloat(paramData.govTallying.vetoThreshold) * 100).toFixed(1) + '%';
    document.getElementById('votingPeriod').textContent = (parseInt(paramData.govVoting.votingPeriod) / 86400) + ' days';

    //SLASHING
    document.getElementById('signedBlockWindow').textContent = (parseInt(paramData.slashing.signedBlocksWindow));
    document.getElementById('signedPerWindow').textContent = (parseFloat(paramData.slashing.minSignedPerWindow) *100).toFixed(1) + '%';
    document.getElementById('downtimeJailDuration').textContent = (parseInt(paramData.slashing.downtimeJailDuration) /60) + ' minutes';
    document.getElementById('slashFractionDoubleSign').textContent = (parseFloat(paramData.slashing.slashFractionDoubleSign) * 100).toFixed(1) + '%';
    document.getElementById('slashFractionDowntime').textContent = (parseFloat(paramData.slashing.slashFractionDowntime) * 100).toFixed(1) + '%';

    //STAKING
    document.getElementById('unbondingTime').textContent = (parseInt(paramData.staking.unbondingTime) / 86400) + 'days';
    document.getElementById('maxValidators').textContent = (paramData.staking.maxValidators);
    document.getElementById('maxExtries').textContent = paramData.staking.maxEntries;
    document.getElementById('historicalEntries').textContent = paramData.staking.historicalEntries;
    document.getElementById('bondDemon').textContent = paramData.staking.bondDenom.toUpperCase();

    //DISTRIBUTION
    document.getElementById('communityTax').textContent = (parseFloat(paramData.distribution.communityTax) / 100).toFixed(1) + '%';
    document.getElementById('baseProposerReward').textContent = (parseFloat(paramData.distribution.baseProposerReward) / 100).toFixed(1) + '%';
    document.getElementById('bonusProposerReward').textContent = (parseFloat(paramData.distribution.bonusProposerReward) / 100).toFixed(1) + '%';
    document.getElementById('withdrawAddressEnabled').textContent = paramData.distribution.withdrawAddrEnabled;

    //VERSION
    document.getElementById('sdkVersion').textContent = paramData.versionInfo.sdkVersion;
    document.getElementById('binaryVersion').textContent = paramData.versionInfo.binaryVersion;
}
