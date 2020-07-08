const { getNewProxyAddress } = require("@aragon/contract-helpers-test/events");

let appManager, user
let vault, stakeToken, stakeTokeManager, requestToken

const ANY_ENTITY = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const HOOKED_TOKEN_MANAGER_APP_ID = "0xb2d2065b829a91588c8b9a15d99acd026f6673733603c6c60e505654eb2b472d"
const toBnWithDecimals = (value, decimals) => {
  const BN = web3.utils.toBN
  return BN(value).mul(BN(10).pow(BN(decimals)))
}

module.exports = {
  postDao: async function({ dao, _experimentalAppInstaller }, builderRuntimeEnv) {
    await postDao(dao, _experimentalAppInstaller, builderRuntimeEnv)
  },

  getInitParams: async function({}, builderRuntimeEnv) {
    return [
      stakeToken.address,
      vault.address,
      requestToken.address,
      9, /* decay */
      2, /* max ratio */
      2, /* weight */
      toBnWithDecimals(20, 16) /* 20% */
    ]
  }
}

const postDao = async (dao, experimentalAppInstaller, builderRuntimeEnv) => {
  [appManager, user] = await web3.eth.getAccounts()
  const acl = await builderRuntimeEnv.artifacts.require("ACL").at(await dao.acl());

  await deployVault(experimentalAppInstaller)

  stakeToken = await deployMinimeToken(builderRuntimeEnv)
  await stakeToken.generateTokens(appManager, toBnWithDecimals(30000, 18))
  await stakeToken.generateTokens(user, toBnWithDecimals(15000, 18))
  console.log(`> Stake token deployed: ${stakeToken.address}`)

  await deployStakeTokenManager(dao, acl, builderRuntimeEnv, experimentalAppInstaller)

  requestToken = await deployMinimeToken(builderRuntimeEnv)
  await requestToken.generateTokens(vault.address, toBnWithDecimals(15000, 18))
  console.log(`> Request token deployed: ${requestToken.address}`)
}

const deployVault = async (experimentalAppInstaller) => {
  vault = await experimentalAppInstaller("vault")
  console.log(`> Vault deployed: ${vault.address}`)
}

const deployMinimeToken = async (builderRuntimeEnv) => {
  const MiniMeTokenFactory = builderRuntimeEnv.artifacts.require('MiniMeTokenFactory')
  const MiniMeToken = builderRuntimeEnv.artifacts.require('MiniMeToken')
  const miniMeTokenFactory = await MiniMeTokenFactory.new()
  return await MiniMeToken.new(miniMeTokenFactory.address, ZERO_ADDRESS, 0, 'MiniMeToken', 18, 'MMT', true)
}

const deployStakeTokenManager = async (dao, acl, builderRuntimeEnv, experimentalAppInstaller) => {

  const hookedTokenManager = await experimentalAppInstaller('hooked-token-manager.open.aragonpm.eth', { version: '1.0.0', network: 'rinkeby' })

  // const HookedTokenManager = builderRuntimeEnv.artifacts.require('HookedTokenManager')
  // const hookedTokenManagerBase = await HookedTokenManager.new()
  // const newHookedTokenManagerReceipt = await dao.newAppInstance(HOOKED_TOKEN_MANAGER_APP_ID, hookedTokenManagerBase.address, "0x", false)
  // const hookedTokenManager = await HookedTokenManager.at(getNewProxyAddress(newHookedTokenManagerReceipt));
  //
  // await stakeToken.changeController(hookedTokenManager.address)
  await hookedTokenManager.initialize(stakeToken.address, true, 0)
  //
  // await acl.createPermission(ANY_ENTITY, hookedTokenManager.address, await hookedTokenManagerBase.MINT_ROLE(), appManager);
  // await acl.createPermission(ANY_ENTITY, hookedTokenManager.address, await hookedTokenManagerBase.BURN_ROLE(), appManager);

  console.log(`> StakeTokenManager deployed: ${hookedTokenManager.address}`)
}
