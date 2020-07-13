let appManager, user
let vault, stakeToken, stakeTokenManager, requestToken

const ANY_ENTITY = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const toBnWithDecimals = (value, decimals) => {
  const BN = web3.utils.toBN
  return BN(value).mul(BN(10).pow(BN(decimals)))
}

module.exports = {
  postDao: async function({ dao, _experimentalAppInstaller }, builderRuntimeEnv) {
    await postDao(_experimentalAppInstaller, builderRuntimeEnv)
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
  },

  postInit: async ({ proxy }, { web3, artifacts }) => {
    const HookedTokenManager = artifacts.require('HookedTokenManager')
    const stakeTokenManagerContract = await HookedTokenManager.at(stakeTokenManager.address)
    await stakeTokenManagerContract.registerHook(proxy.address)
  }
}

const postDao = async (experimentalAppInstaller, builderRuntimeEnv) => {
  [appManager, user] = await web3.eth.getAccounts()

  await deployVault(experimentalAppInstaller)

  stakeToken = await deployMinimeToken(builderRuntimeEnv)
  await stakeToken.generateTokens(appManager, toBnWithDecimals(30000, 18))
  await stakeToken.generateTokens(user, toBnWithDecimals(15000, 18))
  console.log(`> Stake token deployed: ${stakeToken.address}`)

  await deployStakeTokenManager(experimentalAppInstaller)

  requestToken = await deployMinimeToken(builderRuntimeEnv)
  await requestToken.generateTokens(vault.address, toBnWithDecimals(15000, 18))
  console.log(`> Request token deployed: ${requestToken.address}`)
}

const deployVault = async (experimentalAppInstaller) => {
  vault = await experimentalAppInstaller('vault')
  console.log(`> Vault deployed: ${vault.address}`)
}

const deployMinimeToken = async (builderRuntimeEnv) => {
  const MiniMeTokenFactory = builderRuntimeEnv.artifacts.require('MiniMeTokenFactory')
  const MiniMeToken = builderRuntimeEnv.artifacts.require('MiniMeToken')
  const miniMeTokenFactory = await MiniMeTokenFactory.new()
  return await MiniMeToken.new(miniMeTokenFactory.address, ZERO_ADDRESS, 0, 'MiniMeToken', 18, 'MMT', true)
}

const deployStakeTokenManager = async (experimentalAppInstaller) => {
  // There is currently a bug in the experimentalAppInstaller or elsewhere that prevents the display of
  // the IPFS content for the below app in the local client: https://github.com/aragon/buidler-aragon/issues/178
  stakeTokenManager = await experimentalAppInstaller('gardens-token-manager.open.aragonpm.eth',
    { network: 'rinkeby', skipInitialize: true })

  await stakeToken.changeController(stakeTokenManager.address)
  await stakeTokenManager.initialize([stakeToken.address, true, 0])

  await stakeTokenManager.createPermission('MINT_ROLE')
  await stakeTokenManager.createPermission('BURN_ROLE')
  await stakeTokenManager.createPermission('SET_HOOK_ROLE')

  console.log(`> StakeTokenManager deployed: ${stakeTokenManager.address}`)
}
