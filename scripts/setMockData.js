const getProposals = require('./helpers/get-proposals')
const BN = require('bn.js')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle
const globalWeb3 = this.web3 // Not injected unless called directly via truffle

const PROXY_APP_NAMESPACE = '0xd6f028ca0e8edb4a8c9757ca4fdccab25fa1e0317da1188108f7d2dee14902fb'
const KERNEL_DEFAULT_VAULT_APP_ID = '0x7e852e0fcfce6551c13800f1e7476f982525c2b5277ba14b24339c68416336d1'

const bigExp = (x, y = 18) => new BN(x).mul(new BN(10).pow(new BN(y)))
const defaultAmount = 15000

module.exports = async (
  truffleExecCallback,
  { artifacts = globalArtifacts, web3 = globalWeb3, verbose = true } = {}
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const ERC20Token = artifacts.require('ERC20Token')
  const Kernel = artifacts.require('Kernel')
  const Vault = artifacts.require('Vault')
  const ConvictionVoting = artifacts.require('ConvictionVotingApp')

  const [daoAddress, convictionVotingAddress, tokenAddress, tokenAmount = defaultAmount] = process.argv.slice(4)
  const tokenAmountBN = bigExp(tokenAmount)

  // get Vault and ConvictionVoting contract
  const kernel = await Kernel.at(daoAddress)
  const vaultAddress = await kernel.getApp(PROXY_APP_NAMESPACE, KERNEL_DEFAULT_VAULT_APP_ID)
  const vault = await Vault.at(vaultAddress)
  const convictionVoting = await ConvictionVoting.at(convictionVotingAddress)

  try {
    tokenContract = await ERC20Token.at(tokenAddress)

    //make a deposit to the vault
    await tokenContract.approve(vaultAddress, tokenAmountBN.toString())
    await vault.deposit(tokenAddress, tokenAmountBN.toString())

    //create some proposals
    const proposals = await getProposals(web3)
    await Promise.all(proposals.map(proposal => convictionVoting.addProposal(...proposal)))
    await convictionVoting.stakeToProposal(1, 15000)
  } catch (err) {
    console.log(`Error setting mock data: ${err}`)
  }

  if (typeof truffleExecCallback === 'function') {
    // Called directly via `truffle exec`
    truffleExecCallback()
  } else {
    return {}
  }
}