import { randomString, waitting } from './utils/common'
import { Capsolver, CaptchaParams } from './utils/capsolver'
import CurlRequest from './utils/curl'
import { EmailManager } from './utils/email'
import { Logger } from './utils/logger'
import { WalletManager } from './utils/wallet'

const GALXE_URL: string = 'https://graphigo.prd.galaxy.eco/query'

const HEADERS = [
  'Content-Type: application/json',
  'Accept: */*',
  'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
  'Origin: https://app.galxe.com',
  'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.185 Safari/537.36'
]

export interface IUser {
  id: string
  email: string
  address: string
  bitcoinSignetAddress: string
}

interface ITask {
  id: string
  name: string
  eligible: number
}

interface IChapter {
  id: string
  name: string
  tasks: any[]
  claimed: boolean
  answers: string[]
}

const curlRequest: CurlRequest = new CurlRequest()
const capsolver: Capsolver = new Capsolver()
const logger: Logger = new Logger()

/**
 * 银河类
 *
 * 实现了以下功能：
 * 1. 通过 EVM 地址登录
 * 2. 创建账号
 * 3. 绑定邮箱
 * 4. 绑定 Taproot 钱包
 * 5. 完成校验任务
 * 6. 完成表单任务
 * 7. 领取奖励
 */
export class Galxe {
  walletManager: WalletManager
  emailManager: EmailManager

  address: string
  authorization: string = ''

  constructor(pathIndex: number) {
    logger.info('')
    logger.info(`-------- no.${pathIndex} begin --------`)

    this.walletManager = new WalletManager(pathIndex)
    this.emailManager = new EmailManager()

    this.address = this.walletManager.evmWallet.address
  }

  private async request(operationName: string, query: string, body: object, desc: string | null = null): Promise<any> {
    if (desc) logger.debug(`requesting ${desc}.`)

    const headers = [...HEADERS]
    if (this.authorization) headers.push(this.authorization)

    const payload = {
      operationName,
      query,
      variables: body
    }

    const res = await curlRequest.post(GALXE_URL, payload, headers)

    await waitting(1500)

    if (res.data.errors) throw Error(`request error, info: ${JSON.stringify(res.data.errors)}`)

    if (desc) logger.info(`${desc} completed.`)

    return res
  }

  private async sendEmailCode(email: string) {
    const captcha: CaptchaParams | null = await capsolver.getCaptcha()

    const query =
      'mutation SendVerifyCode($input: SendVerificationEmailInput!) {\n  sendVerificationCode(input: $input) {\n    code\n    message\n    __typename\n  }\n}'
    const body = {
      input: {
        email,
        captcha,
        address: `EVM:${this.address}`
      }
    }

    await this.request('SendVerifyCode', query, body)
  }

  async authLogin() {
    const nonce = randomString(17)
    const issuedAt = new Date().toISOString()
    const expiredAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()

    const message = `app.galxe.com wants you to sign in with your Ethereum account:\n${this.address}\n\nSign in with Ethereum to the app.\n\nURI: https://app.galxe.com\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expiredAt}`
    const signature = await this.walletManager.signEvmMessage(message)

    const body = {
      input: {
        address: this.address,
        addressType: 'EVM',
        publicKey: '1',
        message,
        signature
      }
    }

    const query = 'mutation SignIn($input: Auth) {\n signin(input: $input)\n}'
    const desc = `sign in by evm address: ${this.address}`

    const res = await this.request('SignIn', query, body, desc)

    this.authorization = `Authorization: ${res.data.data.signin}`

    logger.info(`get user authorization success, ${this.authorization}`)

    await waitting(2500)
  }

  async checkGalxeIdExist(): Promise<string> {
    const query = 'query GalxeIDExist($schema: String!) {\n  galxeIdExist(schema: $schema)\n}'
    const body = { schema: `EVM:${this.address}` }
    const desc = `galxe id exist by evm address: ${this.address}`

    const res = await this.request('GalxeIDExist', query, body, desc)

    return res.data.data.galxeIdExist
  }

  async getUserInfo(): Promise<IUser> {
    const body = { address: `EVM:${this.address}` }
    const query =
      'query BasicUserInfo($address: String!) {\n  addressInfo(address: $address) {\n    id\n    username\n    avatar\n    address\n    evmAddressSecondary {\n      address\n      __typename\n    }\n    hasEmail\n    solanaAddress\n    aptosAddress\n    seiAddress\n    injectiveAddress\n    flowAddress\n    starknetAddress\n    bitcoinAddress\n    suiAddress\n    stacksAddress\n    azeroAddress\n    archwayAddress\n    bitcoinSignetAddress\n    hasEvmAddress\n    hasSolanaAddress\n    hasAptosAddress\n    hasInjectiveAddress\n    hasFlowAddress\n    hasStarknetAddress\n    hasBitcoinAddress\n    hasSuiAddress\n    hasStacksAddress\n    hasAzeroAddress\n    hasArchwayAddress\n    hasBitcoinSignetAddress\n    hasTwitter\n    hasGithub\n    hasDiscord\n    hasTelegram\n    hasWorldcoin\n    displayEmail\n    displayTwitter\n    displayGithub\n    displayDiscord\n    displayTelegram\n    displayWorldcoin\n    displayNamePref\n    email\n    twitterUserID\n    twitterUserName\n    githubUserID\n    githubUserName\n    discordUserID\n    discordUserName\n    telegramUserID\n    telegramUserName\n    worldcoinID\n    enableEmailSubs\n    subscriptions\n    isWhitelisted\n    isInvited\n    isAdmin\n    accessToken\n    __typename\n  }\n}'
    const desc = 'basic user info'

    const res = await this.request('BasicUserInfo', query, body, desc)

    return res.data.data.addressInfo
  }

  async createNewAccount() {
    const randomUsername = randomString(8)

    const body = {
      input: {
        schema: `EVM:${this.address}`,
        socialUsername: randomUsername,
        username: randomUsername
      }
    }

    await this.request(
      'CreateNewAccount',
      'mutation CreateNewAccount($input: CreateNewAccount!) {\n  createNewAccount(input: $input)\n}',
      body,
      'create galxe id'
    )
  }

  async getCampaignsInfo() {
    const query =
      'query CampaignDetailAll($id: ID!, $address: String!, $withAddress: Boolean!) {\n  campaign(id: $id) {\n    ...CampaignForSiblingSlide\n    coHostSpaces {\n      ...SpaceDetail\n      isAdmin(address: $address) @include(if: $withAddress)\n      isFollowing @include(if: $withAddress)\n      followersCount\n      categories\n      __typename\n    }\n    bannerUrl\n    ...CampaignDetailFrag\n    userParticipants(address: $address, first: 1) @include(if: $withAddress) {\n      list {\n        status\n        premintTo\n        __typename\n      }\n      __typename\n    }\n    space {\n      ...SpaceDetail\n      isAdmin(address: $address) @include(if: $withAddress)\n      isFollowing @include(if: $withAddress)\n      followersCount\n      categories\n      __typename\n    }\n    isBookmarked(address: $address) @include(if: $withAddress)\n    inWatchList\n    claimedLoyaltyPoints(address: $address) @include(if: $withAddress)\n    parentCampaign {\n      id\n      isSequencial\n      thumbnail\n      __typename\n    }\n    isSequencial\n    numNFTMinted\n    childrenCampaigns {\n      ...ChildrenCampaignsForCampaignDetailAll\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment CampaignForTokenObject on Campaign {\n  tokenReward {\n    tokenAddress\n    tokenSymbol\n    tokenDecimal\n    tokenLogo\n    __typename\n  }\n  tokenRewardContract {\n    id\n    chain\n    __typename\n  }\n  __typename\n}\n\nfragment GetImageCommon on Campaign {\n  ...CampaignForTokenObject\n  id\n  type\n  thumbnail\n  __typename\n}\n\nfragment CampaignForGetImage on Campaign {\n  ...GetImageCommon\n  nftTemplates {\n    image\n    __typename\n  }\n  __typename\n}\n\nfragment CampaignForCheckFinish on Campaign {\n  claimedLoyaltyPoints(address: $address)\n  whitelistInfo(address: $address) {\n    usedCount\n    __typename\n  }\n  __typename\n}\n\nfragment CampaignMedia on Campaign {\n  thumbnail\n  rewardName\n  type\n  gamification {\n    id\n    type\n    __typename\n  }\n  __typename\n}\n\nfragment CampaignForgePage on Campaign {\n  id\n  numberID\n  chain\n  spaceStation {\n    address\n    __typename\n  }\n  gamification {\n    forgeConfig {\n      maxNFTCount\n      minNFTCount\n      requiredNFTs {\n        nft {\n          category\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment CampaignForParticipantsDialog on Campaign {\n  id\n  name\n  type\n  rewardType\n  chain\n  nftHolderSnapshot {\n    holderSnapshotBlock\n    __typename\n  }\n  space {\n    isAdmin(address: $address)\n    __typename\n  }\n  rewardInfo {\n    discordRole {\n      guildName\n      roleName\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment CampaignForCampaignParticipantsBox on Campaign {\n  ...CampaignForParticipantsDialog\n  id\n  chain\n  space {\n    id\n    isAdmin(address: $address)\n    __typename\n  }\n  participants {\n    participants(first: 10, after: "-1", download: false) {\n      list {\n        address {\n          id\n          avatar\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    participantsCount\n    bountyWinners(first: 10, after: "-1", download: false) {\n      list {\n        createdTime\n        address {\n          id\n          avatar\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    bountyWinnersCount\n    __typename\n  }\n  __typename\n}\n\nfragment NftCoreInfoFrag on NFTCore {\n  id\n  capable\n  chain\n  contractAddress\n  name\n  symbol\n  __typename\n}\n\nfragment WhitelistInfoFrag on Campaign {\n  id\n  whitelistInfo(address: $address) {\n    address\n    maxCount\n    usedCount\n    claimedLoyaltyPoints\n    currentPeriodClaimedLoyaltyPoints\n    currentPeriodMaxLoyaltyPoints\n    __typename\n  }\n  __typename\n}\n\nfragment WhitelistSubgraphFrag on Campaign {\n  id\n  whitelistSubgraph {\n    query\n    endpoint\n    expression\n    variable\n    __typename\n  }\n  __typename\n}\n\nfragment GamificationDetailFrag on Gamification {\n  id\n  type\n  nfts {\n    nft {\n      id\n      animationURL\n      category\n      powah\n      image\n      name\n      treasureBack\n      nftCore {\n        ...NftCoreInfoFrag\n        __typename\n      }\n      traits {\n        name\n        value\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  forgeConfig {\n    minNFTCount\n    maxNFTCount\n    requiredNFTs {\n      nft {\n        category\n        powah\n        image\n        name\n        nftCore {\n          capable\n          contractAddress\n          __typename\n        }\n        __typename\n      }\n      count\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment CredForAddressWithoutMetadata on Cred {\n  id\n  name\n  type\n  credType\n  credSource\n  referenceLink\n  description\n  lastUpdate\n  lastSync\n  syncStatus\n  credContractNFTHolder {\n    timestamp\n    __typename\n  }\n  chain\n  eligible(address: $address)\n  subgraph {\n    endpoint\n    query\n    expression\n    __typename\n  }\n  dimensionConfig\n  value {\n    gitcoinPassport {\n      score\n      lastScoreTimestamp\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment CredentialGroupConditionForVerifyButton on CredentialGroupCondition {\n  expression\n  eligibleAddress\n  __typename\n}\n\nfragment CredentialGroupForAddress on CredentialGroup {\n  id\n  description\n  credentials {\n    ...CredForAddressWithoutMetadata\n    __typename\n  }\n  conditionRelation\n  conditions {\n    expression\n    eligible\n    ...CredentialGroupConditionForVerifyButton\n    __typename\n  }\n  rewards {\n    expression\n    eligible\n    rewardCount\n    rewardType\n    __typename\n  }\n  rewardAttrVals {\n    attrName\n    attrTitle\n    attrVal\n    __typename\n  }\n  claimedLoyaltyPoints\n  __typename\n}\n\nfragment ExpressionEntity on ExprEntity {\n  cred {\n    id\n    name\n    type\n    credType\n    credSource\n    dimensionConfig\n    referenceLink\n    description\n    lastUpdate\n    lastSync\n    chain\n    eligible(address: $address)\n    metadata {\n      visitLink {\n        link\n        __typename\n      }\n      twitter {\n        isAuthentic\n        __typename\n      }\n      worldcoin {\n        dimensions {\n          values {\n            value\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    commonInfo {\n      participateEndTime\n      modificationInfo\n      __typename\n    }\n    __typename\n  }\n  attrs {\n    attrName\n    operatorSymbol\n    targetValue\n    __typename\n  }\n  attrFormula\n  eligible\n  eligibleAddress\n  __typename\n}\n\nfragment ExpressionReward on ExprReward {\n  arithmetics {\n    ...ExpressionEntity\n    __typename\n  }\n  arithmeticFormula\n  rewardType\n  rewardCount\n  rewardVal\n  __typename\n}\n\nfragment SpaceDetail on Space {\n  id\n  name\n  info\n  thumbnail\n  alias\n  status\n  links\n  isVerified\n  discordGuildID\n  followersCount\n  nftCores(input: {first: 1}) {\n    list {\n      id\n      marketLink\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment CampaignDetailFrag on Campaign {\n  id\n  ...CampaignMedia\n  ...CampaignForgePage\n  ...CampaignForCampaignParticipantsBox\n  nftCore {\n    ...NftCoreInfoFrag\n    __typename\n  }\n  name\n  numberID\n  type\n  inWatchList\n  cap\n  info\n  useCred\n  smartbalancePreCheck(mintCount: 1)\n  smartbalanceDeposited\n  formula\n  status\n  seoImage\n  creator\n  tags\n  thumbnail\n  gasType\n  isPrivate\n  createdAt\n  requirementInfo\n  description\n  enableWhitelist\n  chain\n  startTime\n  endTime\n  requireEmail\n  requireUsername\n  blacklistCountryCodes\n  whitelistRegions\n  rewardType\n  distributionType\n  rewardName\n  claimEndTime\n  loyaltyPoints\n  tokenRewardContract {\n    id\n    address\n    chain\n    __typename\n  }\n  tokenReward {\n    userTokenAmount\n    tokenAddress\n    depositedTokenAmount\n    tokenRewardId\n    tokenDecimal\n    tokenLogo\n    tokenSymbol\n    __typename\n  }\n  nftHolderSnapshot {\n    holderSnapshotBlock\n    __typename\n  }\n  spaceStation {\n    id\n    address\n    chain\n    __typename\n  }\n  ...WhitelistInfoFrag\n  ...WhitelistSubgraphFrag\n  gamification {\n    ...GamificationDetailFrag\n    __typename\n  }\n  creds {\n    id\n    name\n    type\n    credType\n    credSource\n    referenceLink\n    description\n    lastUpdate\n    lastSync\n    syncStatus\n    credContractNFTHolder {\n      timestamp\n      __typename\n    }\n    chain\n    eligible(address: $address, campaignId: $id)\n    subgraph {\n      endpoint\n      query\n      expression\n      __typename\n    }\n    dimensionConfig\n    value {\n      gitcoinPassport {\n        score\n        lastScoreTimestamp\n        __typename\n      }\n      __typename\n    }\n    commonInfo {\n      participateEndTime\n      modificationInfo\n      __typename\n    }\n    __typename\n  }\n  credentialGroups(address: $address) {\n    ...CredentialGroupForAddress\n    __typename\n  }\n  rewardInfo {\n    discordRole {\n      guildId\n      guildName\n      roleId\n      roleName\n      inviteLink\n      __typename\n    }\n    premint {\n      startTime\n      endTime\n      chain\n      price\n      totalSupply\n      contractAddress\n      banner\n      __typename\n    }\n    loyaltyPoints {\n      points\n      __typename\n    }\n    loyaltyPointsMysteryBox {\n      points\n      weight\n      __typename\n    }\n    __typename\n  }\n  participants {\n    participantsCount\n    bountyWinnersCount\n    __typename\n  }\n  taskConfig(address: $address) {\n    participateCondition {\n      conditions {\n        ...ExpressionEntity\n        __typename\n      }\n      conditionalFormula\n      eligible\n      __typename\n    }\n    requiredInfo {\n      socialInfos {\n        email\n        discordUserID\n        twitterUserID\n        telegramUserID\n        githubUserID\n        googleUserID\n        worldcoinID\n        __typename\n      }\n      addressInfos {\n        address\n        evmAddressSecondary\n        solanaAddress\n        aptosAddress\n        seiAddress\n        injectiveAddress\n        flowAddress\n        starknetAddress\n        suiAddress\n        bitcoinAddress\n        stacksAddress\n        azeroAddress\n        archwayAddress\n        __typename\n      }\n      __typename\n    }\n    rewardConfigs {\n      id\n      conditions {\n        ...ExpressionEntity\n        __typename\n      }\n      conditionalFormula\n      description\n      rewards {\n        ...ExpressionReward\n        __typename\n      }\n      eligible\n      rewardAttrVals {\n        attrName\n        attrTitle\n        attrVal\n        __typename\n      }\n      __typename\n    }\n    referralConfig {\n      id\n      conditions {\n        ...ExpressionEntity\n        __typename\n      }\n      conditionalFormula\n      description\n      rewards {\n        ...ExpressionReward\n        __typename\n      }\n      eligible\n      rewardAttrVals {\n        attrName\n        attrTitle\n        attrVal\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  referralCode(address: $address)\n  recurringType\n  latestRecurringTime\n  nftTemplates {\n    id\n    image\n    treasureBack\n    __typename\n  }\n  __typename\n}\n\nfragment CampaignForSiblingSlide on Campaign {\n  id\n  space {\n    id\n    alias\n    __typename\n  }\n  parentCampaign {\n    id\n    thumbnail\n    isSequencial\n    childrenCampaigns {\n      id\n      ...CampaignForGetImage\n      ...CampaignForCheckFinish\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment ChildrenCampaignsForCampaignDetailAll on Campaign {\n  space {\n    ...SpaceDetail\n    isAdmin(address: $address) @include(if: $withAddress)\n    isFollowing @include(if: $withAddress)\n    followersCount\n    categories\n    __typename\n  }\n  ...CampaignDetailFrag\n  claimedLoyaltyPoints(address: $address) @include(if: $withAddress)\n  userParticipants(address: $address, first: 1) @include(if: $withAddress) {\n    list {\n      status\n      __typename\n    }\n    __typename\n  }\n  parentCampaign {\n    id\n    isSequencial\n    __typename\n  }\n  __typename\n}'

    const body = {
      id: 'GCyyntz73L',
      address: this.address,
      withAddress: true
    }

    const res = await this.request('CampaignDetailAll', query, body, 'campaigns detail')

    return res.data.data.campaign.childrenCampaigns
  }

  async startCampaigns() {
    const campaigns = await this.getCampaignsInfo()

    // chapter1 需要填写对应的答案
    const chapters: IChapter[] = [
      {
        id: campaigns[1]['id'],
        name: campaigns[1]['name'],
        tasks: campaigns[1]['credentialGroups'][0]['credentials'],
        claimed: campaigns[1]['claimedLoyaltyPoints'] > 0,
        answers: ['hello world']
      }
    ]

    for (let chapter of chapters) {
      if (!chapter.claimed) {
        const results: Boolean[] = []

        for (let [taskIndex, task] of chapter.tasks.entries()) {
          const res = taskIndex === 0 ? await this.submitTask(task) : await this.submitTask(task, chapter.answers)

          results.push(res)
        }

        if (results.every((result) => result)) await this.claimChapter(chapter)
      } else {
        logger.info(`chapter - ${chapter.name} completed, skip next chapter.`)
      }
    }
  }

  async submitTask(task: ITask, answers: string[] = []) {
    if (task.eligible) {
      logger.warn(`task - ${task.name} completed, skip next task.`)

      return true
    }

    logger.debug(`waitting to submit task - ${task.name}`)

    const query =
      'mutation SyncCredentialValue($input: SyncCredentialValueInput!) {\n  syncCredentialValue(input: $input) {\n    value {\n      address\n      spaceUsers {\n        follow\n        points\n        participations\n        __typename\n      }\n      campaignReferral {\n        count\n        __typename\n      }\n      gitcoinPassport {\n        score\n        lastScoreTimestamp\n        __typename\n      }\n      walletBalance {\n        balance\n        __typename\n      }\n      multiDimension {\n        value\n        __typename\n      }\n      allow\n      survey {\n        answers\n        __typename\n      }\n      quiz {\n        allow\n        correct\n        __typename\n      }\n      __typename\n    }\n    message\n    __typename\n  }\n}'
    const body = {
      input: {
        syncOptions: {
          credId: task.id,
          address: `EVM:${this.address}`,
          ...(answers.length && { survey: { answers } })
        }
      }
    }

    const res = await this.request('SyncCredentialValue', query, body)

    if (res.data.data.syncCredentialValue && res.data.data.syncCredentialValue.message) {
      logger.warn(`task - ${task.name} claim fail: ${res.data.data.syncCredentialValue.message}`)

      return false
    }

    logger.info(`task - ${task.name} completed!`)

    return true
  }

  async claimChapter(chapter: IChapter) {
    const captcha: CaptchaParams | null = await capsolver.getCaptcha()

    const query =
      'mutation PrepareParticipate($input: PrepareParticipateInput!) {\n  prepareParticipate(input: $input) {\n    allow\n    disallowReason\n    signature\n    nonce\n    mintFuncInfo {\n      funcName\n      nftCoreAddress\n      verifyIDs\n      powahs\n      cap\n      __typename\n    }\n    extLinkResp {\n      success\n      data\n      error\n      __typename\n    }\n    metaTxResp {\n      metaSig2\n      autoTaskUrl\n      metaSpaceAddr\n      forwarderAddr\n      metaTxHash\n      reqQueueing\n      __typename\n    }\n    solanaTxResp {\n      mint\n      updateAuthority\n      explorerUrl\n      signedTx\n      verifyID\n      __typename\n    }\n    aptosTxResp {\n      signatureExpiredAt\n      tokenName\n      __typename\n    }\n    spaceStation\n    airdropRewardCampaignTxResp {\n      airdropID\n      verifyID\n      index\n      account\n      amount\n      proof\n      __typename\n    }\n    tokenRewardCampaignTxResp {\n      signatureExpiredAt\n      verifyID\n      __typename\n    }\n    loyaltyPointsTxResp {\n      TotalClaimedPoints\n      __typename\n    }\n    flowTxResp {\n      Name\n      Description\n      Thumbnail\n      __typename\n    }\n    suiTxResp {\n      packageId\n      tableId\n      nftName\n      campaignId\n      verifyID\n      imgUrl\n      signatureExpiredAt\n      __typename\n    }\n    __typename\n  }\n}'
    const body = {
      input: {
        captcha,
        chain: 'ETHEREUM',
        campaignID: chapter.id,
        address: `EVM:${this.address}`,
        mintCount: 1,
        signature: ''
      }
    }
    const desc = `claim chapter - ${chapter.name}`

    await this.request('PrepareParticipate', query, body, desc)
  }

  async bindSignetAddress() {
    const { taprootWallet, evmWallet } = this.walletManager

    const nonce = 10000000 + Math.floor(Math.random() * 10000000)
    const signature = this.walletManager.signTaprootMessage(
      `You are updating your Galaxy profile with bitcoin signet address ${taprootWallet.address}. Please sign the transaction to confirm.\nnonce: ${nonce}`
    )

    const query =
      'mutation UpdateUserAddress($input: UpdateUserAddressInput!) {\n  updateUserAddress(input: $input) {\n    code\n    message\n    __typename\n  }\n}'
    const body = {
      input: {
        address: evmWallet.address,
        addressType: 'EVM',
        updateAddress: taprootWallet.address,
        updateAddressType: 'BITCOIN_SIGNET',
        sig: signature,
        sigNonce: nonce,
        addressPublicKey: taprootWallet.internalPubkey.toString('hex')
      }
    }

    await this.request('UpdateUserAddress', query, body, 'bind signet address')
  }

  async bindEmail() {
    const email = await this.emailManager.getEmail()

    await this.sendEmailCode(email)

    const code = await this.emailManager.getEmailCode()

    logger.info(`get email info success, email: ${email}, verify code: ${code}`)

    const query =
      'mutation UpdateEmail($input: UpdateEmailInput!) {\n  updateEmail(input: $input) {\n    code\n    message\n    __typename\n  }\n}'
    const body = {
      input: {
        address: `EVM:${this.address}`,
        email: this.emailManager,
        verificationCode: code
      }
    }

    await this.request('UpdateEmail', query, body, 'bind email')
  }
}
