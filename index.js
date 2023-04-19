const rpcUrl = 'https://rpc.bt.io'
const { ethers } = require("ethers");
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const tokenAbi = require('./token.json');
const roomAbi = require('./Cooperation.json');
const adapter = new FileSync('./pools.json');
const db = low(adapter);
//
const basePrice = {
  '0xdb28719f7f938507dbfe4f0eae55668903d34a15': 1
}
const rewardToken = '0x6fc441E5C55e4A5DDDdB3E3d7335877E5D20b002';
const roomAddress = '0x3a1bb191d89ace21518fb01d73c143da2b0c5fae';
const rewardPrice = 1
//
async function getData() {
  const pools = await db.get(`pools`).value();
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const roomContract = await new ethers.Contract(roomAddress, roomAbi, provider);
  const totalAllocPoint= await roomContract['totalAllocPoint']();
  const coinPerBlock = await roomContract['coinPerBlock']();
  const cycle = await roomContract['cycle']();
  const totalReward = coinPerBlock.toString()/1e+18 * cycle;
  const poolData = [];
  for(const pool of pools) {
    const { staking_token, pair_main, pool_id } = pool;
    const lpContract = new ethers.Contract(staking_token, tokenAbi, provider);
    const totalSupply = await lpContract['totalSupply']();
    const totalAmount = ethers.utils.formatUnits(totalSupply, 18);
    const baseToken = pool[`pair_${pair_main}`];
    const baseTokenContract = new ethers.Contract(baseToken, tokenAbi, provider);
    const poolStake = await lpContract['balanceOf'](roomAddress);
    const baseBalance = await baseTokenContract['balanceOf'](staking_token);
    const baseDecimal = await baseTokenContract['decimals']();
    const totalTvl = ethers.utils.formatUnits(baseBalance, baseDecimal) * basePrice[baseToken] * 2;
    const stakeTvl = totalTvl * ethers.utils.formatUnits(poolStake, 18) / totalAmount || 1;
    const poolInfo = await roomContract['poolInfo'](pool_id);
    const poolReward = poolInfo['allocPoint'].toNumber()/ totalAllocPoint.toNumber() * totalReward;
    const apy = poolReward * rewardPrice / stakeTvl * 100;
    poolData.push(Object.assign(pool, {pool_tvl: stakeTvl, pool_reward: poolReward, pool_apy: apy, updated_at: new Date().getTime()}));
  }
  console.log('poolData', poolData)
  db.set(`pools`, poolData).write();
}

getData()
