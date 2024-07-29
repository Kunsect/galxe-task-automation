import logger from '../logger'
import curl from '../requests/curl'
import { Twitter } from '../twitter'
import { GalxeQuery } from './query'
import { EmailManager } from '../email'
import { WalletManager } from '../wallet'
import { CaptchaDecoder, ICaptchaParams } from '../captcha'
import { randomString, waittingBetween } from '../utils/common'

const GALXE_URL: string = 'https://graphigo.prd.galaxy.eco/query'

const HEADERS = [
  'Content-Type: application/json',
  'Accept: */*',
  'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
  'Origin: https://app.galxe.com',
  'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Sec-Ch-Ua: "Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  'Sec-Ch-Ua-Mobile: ?0',
  'Sec-Ch-Ua-Platform: "Windows"'
]

export interface IUser {
  id: string
  email: string
  address: string
  bitcoinSignetAddress: string
  hasTwitter: boolean
}

interface ITask {
  id: string
  campaignId: string
  name: string
  eligible: number
  credSource: string
  credType: string
  claimed: boolean

  referenceLink?: string // twitter 链接
  description?: string // twitter desc
}

interface IGampaignGroup {
  tasks: ITask[]
  campaignId: string
  claimed: boolean
  allEligible: boolean // 判断被过滤的任务是否有资格 claim
}

interface ICampaign {
  id: string
  name: string
  group: IGampaignGroup[]
  claimed: boolean
}

/**
 * 银河类
 *
 * 实现了以下功能：
 * 1.  通过 EVM 地址登录
 * 2.  创建账号
 * 3.  绑定邮箱
 * 5.  绑定推特
 * 6.  绑定 Taproot 钱包
 * 7.  完成校验任务
 * 8.  完成表单任务
 * 9.  完成 twitter 任务（点赞、转发、@ 好友、关注）
 * 10. 完成浏览链接任务
 * 11. 完成关注 space 任务
 * 12. 领取奖励
 */
export class Galxe {
  twitter: Twitter
  emailManager: EmailManager
  walletManager: WalletManager
  captchaDecoder: CaptchaDecoder

  address: string
  userId: string = ''
  username: string = ''
  authorization: string = ''
  spaceId: string = '' // 平台关注任务使用

  constructor(pathIndex: number) {
    logger.info('')
    logger.info(`-------- no.${pathIndex} begin --------`)

    this.twitter = new Twitter(pathIndex)
    this.emailManager = new EmailManager()
    this.captchaDecoder = new CaptchaDecoder()
    this.walletManager = new WalletManager(pathIndex)

    this.address = this.walletManager.evmWallet.address
  }

  private async request(
    operationName: string,
    query: string,
    body: object,
    desc: string | null = null,
    needCaptcha: boolean = false
  ): Promise<any> {
    if (desc) logger.debug(`requesting ${desc}.`)

    const headers = [...HEADERS, ...(this.authorization ? [this.authorization] : [])]

    const payload = {
      operationName,
      query,
      variables: body
    }

    let result = null
    for (let i = 0; i < 3; i++) {
      if (needCaptcha) {
        const captcha: ICaptchaParams | null = await this.captchaDecoder.getCaptcha()

        if ((payload.variables as any).input instanceof Object) {
          ;(payload.variables as any).input.captcha = captcha
        }
      }

      const res = await curl.post(GALXE_URL, payload, headers)

      await waittingBetween(3000, 4500)

      if (res.data.errors) {
        console.log(JSON.stringify(payload))

        const message = res.data.errors[0]['message']

        // 解码平台 token 有误
        if (message.includes('pass_token error')) {
          logger.warn(`[captcha] failed to verify recaptcha token, (${i + 1} / 3) will try again, info: ${message}`)

          await waittingBetween(5000, 7000)
        } else {
          throw Error(`request error, info: ${JSON.stringify(res.data.errors)}`)
        }
      } else {
        if (desc) logger.info(`${desc} completed.`)

        result = res
        break
      }
    }

    return result
  }

  private async sendEmailCode(email: string) {
    const body = {
      input: { email, address: `EVM:${this.address}` }
    }

    await this.request('SendVerifyCode', GalxeQuery.sendEmailCode, body, 'send email code', true)
  }

  async authLogin() {
    const nonce = randomString(17, true)
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

    const desc = `sign in by evm address: ${this.address}`

    const res = await this.request('SignIn', GalxeQuery.signin, body, desc)

    this.authorization = `Authorization: ${res.data.data.signin}`

    logger.info(`get user authorization success, ${this.authorization}`)
  }

  async checkGalxeIdExist(): Promise<string> {
    const body = { schema: `EVM:${this.address}` }
    const desc = `galxe id exist by evm address: ${this.address}`

    const res = await this.request('GalxeIDExist', GalxeQuery.idExist, body, desc)

    return res.data.data.galxeIdExist
  }

  async getUserInfo(): Promise<IUser> {
    const body = { address: `EVM:${this.address}` }

    const desc = 'basic user info'

    const res = await this.request('BasicUserInfo', GalxeQuery.userInfo, body, desc)

    return res.data.data.addressInfo
  }

  async createNewAccount() {
    const username = randomString(8)

    const body = {
      input: {
        schema: `EVM:${this.address}`,
        socialUsername: username,
        username: username
      }
    }

    await this.request(
      'CreateNewAccount',
      'mutation CreateNewAccount($input: CreateNewAccount!) {\n  createNewAccount(input: $input)\n}',
      body,
      'create galxe id'
    )
  }

  async getCampaignsInfo(id: string) {
    const body = {
      id,
      address: this.address,
      withAddress: true
    }

    const res = await this.request('CampaignDetailAll', GalxeQuery.campaignsInfo, body, 'campaigns detail')
    this.spaceId = res.data.data.campaign.space.id

    return res.data.data.campaign.childrenCampaigns
  }

  async submitTask(task: ITask) {
    const retryCount = 3
    let result = false

    for (let i = 0; i < retryCount; i++) {
      await waittingBetween(3000, 5000)

      const taskLabel = `[TASK - ${task.name}]`

      if (task.eligible) {
        logger.warn(`${taskLabel} completed, skip next task.`)

        return true
      }

      logger.debug(`${taskLabel} waitting to submit task...`)

      const body: any = {
        input: {
          syncOptions: {
            credId: task.id,
            address: `EVM:${this.address}`
          }
        }
      }

      // 前置交互
      switch (task.credType) {
        case 'TWITTER':
          if (task.credSource === 'TWITTER_LIKE') await this.tryAppend(task, taskLabel)

          const captcha: ICaptchaParams | null = await this.captchaDecoder.getCaptcha()
          body.input.syncOptions = {
            ...body.input.syncOptions,
            twitter: {
              campaignID: task.campaignId,
              captcha
            }
          }
          break

        default:
          break
      }

      // 根据类型进行交互
      switch (task.credSource) {
        case 'VISIT_LINK':
          // 浏览链接
          await this.tryAppend(task, taskLabel)
          break

        case 'SPACE_USERS':
          // 平台关注
          await this.followSpace()
          break

        case 'QUIZ':
          // 问卷
          body.input.syncOptions = {
            ...body.input.syncOptions,
            quiz: {
              answers: ['0', 'Vanderbilt', '1', 'San Francisco']
            }
          }
          break

        default:
          break
      }

      const res = await this.request('SyncCredentialValue', GalxeQuery.submitTask, body, taskLabel)
      const credValue = res.data.data.syncCredentialValue

      // 特殊类型判断返回
      if (task.credSource === 'SPACE_USERS' && credValue.value.spaceUsers.follow) credValue.value.allow = true
      if (task.credSource === 'QUIZ' && credValue.value.quiz.allow) credValue.value.allow = true

      if (credValue.value.allow) {
        result = true

        break
      }

      if (credValue.message) {
        logger.error(`${taskLabel} complete fail: ${credValue.message}`)
      }

      if (i < retryCount - 1) {
        console.log(JSON.stringify(credValue))
        logger.warn(`${taskLabel} (${i + 1} / ${retryCount}) will try again.`)

        if (task.credType === 'TWITTER') {
          logger.error(`[twitter] ${taskLabel} complete fail: after 55-60s continue...`)

          await waittingBetween(55000, 65000)
        }
      } else {
        logger.error(`${taskLabel} all trying failed.`)

        result = false
      }
    }

    return result
  }

  async claimCampaign(campaign: ICampaign) {
    for (let i = 0; i < 5; i++) {
      await waittingBetween(3000, 5000)

      const campaignLabel = `[CAMPAIGN - ${campaign.name}]`

      const body = {
        input: {
          chain: 'ETHEREUM',
          campaignID: campaign.id,
          address: `EVM:${this.address}`,
          mintCount: 1,
          signature: ''
        }
      }

      const res = await this.request('PrepareParticipate', GalxeQuery.claimCampaign, body, campaignLabel, true)

      if (!res.data.data.prepareParticipate.allow) {
        const reason = res.data.data.prepareParticipate.disallowReason
        logger.error(`${campaignLabel} claim campaign fail: ${reason}`)

        if (reason.includes('empty reward')) break

        if (i < 4) logger.warn(`${campaignLabel} (${i + 1} / 5) campaign will try again.`)
        else logger.error(`${campaignLabel} all trying failed.`)
      } else {
        break
      }
    }
  }

  async bindEmail() {
    const email = await this.emailManager.getEmail()

    await this.sendEmailCode(email)

    const code = await this.emailManager.getEmailCode()

    logger.info(`get email info success, email: ${email}, verify code: ${code}`)

    const body = {
      input: {
        address: `EVM:${this.address}`,
        email,
        verificationCode: code
      }
    }

    await this.request('UpdateEmail', GalxeQuery.updateEmail, body, 'bind email')
  }

  async bindTwitter() {
    const tweetUrl = await this.twitter.createBindTweet(this.userId)

    if (!tweetUrl) logger.error('bind create tweet fail.')

    const body = {
      input: {
        address: this.address,
        tweetURL: tweetUrl
      }
    }

    await this.request('VerifyTwitterAccount', GalxeQuery.verifyTwitter, body, 'bind twitter')
  }

  async unbindTwitter() {
    const body = {
      input: {
        address: `EVM:${this.address}`,
        type: 'TWITTER'
      }
    }

    await this.request('DeleteSocialAccount', GalxeQuery.deleteSocialAccount, body, 'unbind twitter')
  }

  async updateBaseInfo() {
    const galxeIdExist = await this.checkGalxeIdExist()

    if (!galxeIdExist) {
      logger.warn('galxe id not exist, go to create new account.')

      await this.createNewAccount()
    }

    const userInfo = await this.getUserInfo()
    this.userId = userInfo.id

    if (!userInfo.email) await this.bindEmail()
    else logger.warn(`User has already bound an email address, skip the email binding step.`)

    const needTwitter = Number(process.env.NEED_TWITTER) === 1
    if (needTwitter) {
      if (!userInfo.hasTwitter) await this.bindTwitter()
      else logger.warn(`User has already bound twitter, skip the twitter binding step.`)
    } else {
      logger.warn(`User don't need to bind twitter, skip the twitter binding step.`)
    }
  }

  async tryAppend(task: ITask, label: string) {
    const appendBody = {
      input: {
        credId: task.id,
        campaignId: task.campaignId,
        operation: 'APPEND',
        items: [`EVM:${this.address}`]
      }
    }

    await this.request(
      'AddTypedCredentialItems',
      GalxeQuery.addTypedCredentialItems,
      appendBody,
      `[append credential] try append by ${label}`,
      true
    )

    await waittingBetween(5000, 8000)
  }

  async followSpace() {
    const body = { spaceIds: [this.spaceId] }

    await this.request('followSpace', GalxeQuery.followSpace, body, `follow space ${this.spaceId}`)

    await waittingBetween(3000, 5000)
  }

  async startCampaigns() {
    const { GALXE_COLLECT, GALXE_CAMPAIGNS_INDEXES } = process.env

    if (!GALXE_COLLECT) throw Error('please fill in the GALXE_COLLECT in .env')

    const campaignsRes = await this.getCampaignsInfo(GALXE_COLLECT)

    let campaigns: ICampaign[] = []
    campaignsRes.map((campaign: any) => {
      campaigns.push({
        id: campaign.id,
        name: campaign.name,
        group: campaign['credentialGroups'].map((item: any) => ({
          tasks: item.credentials.map((credential: any) => ({ ...credential, campaignId: campaign.id })),
          claimed: item.claimedLoyaltyPoints > 0,
          campaignId: campaign.id,
          allEligible: false
        })),
        claimed:
          campaign.whitelistInfo.currentPeriodClaimedLoyaltyPoints >=
            campaign.whitelistInfo.currentPeriodClaimedLoyaltyPoints &&
          campaign.claimedLoyaltyPoints >= campaign.loyaltyPoints
      })
    })

    // 根据 .env 的 GALXE_CAMPAIGNS_INDEXES 重新渲染执行任务列表
    // 若有 twitter 先完成 twitter 的前置交互
    const twitterTasks: ITask[] = []
    if (GALXE_CAMPAIGNS_INDEXES) {
      const [campaignIndex, groupIndex, tasksIndexes] = GALXE_CAMPAIGNS_INDEXES.split(':')
      const tasksArr = tasksIndexes.split(',').map(Number)

      const selectedCampaign = campaigns[Number(campaignIndex)]
      selectedCampaign.group = [selectedCampaign.group[Number(groupIndex)]]

      const selectedTasks = selectedCampaign.group[0]['tasks'].filter((item, index) => tasksArr.includes(index))
      const unselectedTasks = selectedCampaign.group[0]['tasks'].filter((item, index) => !tasksArr.includes(index))

      selectedTasks.map((task) => {
        if (!task.eligible && task.credType === 'TWITTER') twitterTasks.push(task)
      })

      selectedCampaign.group[0]['tasks'] = selectedTasks
      selectedCampaign.group[0]['allEligible'] = unselectedTasks.every((task: ITask) => task.eligible)

      campaigns = [selectedCampaign]
    }

    if (twitterTasks.length) await this.startTwitterTasks(twitterTasks)

    for (let campaign of campaigns) {
      if (campaign.claimed) {
        logger.info(`[CAMPAIGN - ${campaign.name}] completed, skip next campaign.`)

        continue
      }

      for (let item of campaign.group) {
        let tasksResult = []

        for (let task of item.tasks) {
          if (!task.eligible) tasksResult.push(await this.submitTask(task))
        }

        if (item.allEligible && tasksResult.every((result) => result)) await this.claimCampaign(campaign)
      }
    }
  }

  async startTwitterTasks(twitterTasks: ITask[]) {
    for (let task of twitterTasks) {
      switch (task.credSource) {
        case 'TWITTER_FOLLOW': {
          // 关注推特
          const nameMatch = task.referenceLink!.match(/[?&]screen_name=([^&]+)/)
          const name = nameMatch && nameMatch[1]
          if (!name) throw Error('tweet name not found.')

          await this.twitter.follow(name)
          break
        }

        case 'TWITTER_LIKE': {
          // 点赞推文
          const tweetIdMatch = task.referenceLink!.match(/tweet_id=(\d+)/)
          const tweetId = tweetIdMatch && tweetIdMatch[1]
          if (!tweetId) throw Error('tweet id not found.')

          await this.twitter.likeTweet(tweetId)
          break
        }

        case 'TWITTER_RT': {
          // 转发推文
          const tweetIdMatch = task.referenceLink!.match(/tweet_id=(\d+)/)
          const tweetId = tweetIdMatch && tweetIdMatch[1]
          if (!tweetId) throw Error('tweet id not found.')

          await this.twitter.reTweet(tweetId)
          break
        }

        case 'TWITTER_QUOTE': {
          // 创建推文并 @ 好友
          const tweetUrlMatch = task.description!.match(/\(([^)]+)\)/)
          const tweetUrl = tweetUrlMatch && tweetUrlMatch[1]

          await this.twitter.createPost(`@MaplestoryU ${tweetUrl}`)
          break
        }

        default:
          break
      }

      await waittingBetween(5000, 8000)
    }
  }

  async getSpaceScore(name: string) {
    const body = {
      alias: name,
      address: `EVM:${this.address}`,
      firstTailoredTask: 10,
      afterTailoredTask: '-1'
    }

    const res = await this.request('SpaceBasicWithAuthQuery', GalxeQuery.spaceInfo, body, `get space score`)

    return res.data.data.space
  }
}
