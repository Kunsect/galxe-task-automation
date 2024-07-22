import * as fs from 'fs'
import logger from './../src/logger'
import { Galxe } from './../src/galxe'
import { readFileToArray, waittingBetween } from './../src/utils/common'
import 'dotenv/config'

/**
 * 执行 Galxe 任务的主流程
 *
 * 1. 获取助记词对应派生地址的钱包
 * 2. 通过 EVM 地址登录账号
 * 3. 校验账号是否注册（没注册的走注册流程）
 * 4. 绑定其他类型的钱包地址及邮箱
 * 5. 获取任务状态（未领取奖励的会执行）
 */
const main = async () => {
  let pathIndex: number = Number(process.env.START_PATH_INDEX)
  const maxPathIndex: number = Number(process.env.MAX_PATH_INDEX)

  while (pathIndex < maxPathIndex) {
    const galxe = new Galxe(pathIndex)

    try {
      await galxe.authLogin()

      await galxe.updateBaseInfo()

      await galxe.startCampaigns()

      logger.info('============== galxe tasks finish! continue next path ==============')

      pathIndex += 1
    } catch (err: any) {
      logger.error(err.message)
      logger.debug('uncatch error，waitting 20s to continue...')

      /**
       * twitter 报错处理
       * 捕捉到上述错误码的一般为不可用的 twitter 号，需要从列表中剔除并重新绑定 twitter 执行任务
       *
       * 37: Authorization: Denied by access control: Missing TwitterUserNotSuspended
       * 64: Your account is suspended and is not permitted to access this feature
       * 141: Authorization: User (uid: 1813038126891200512) is suspended, deactivated or offboarded
       * 187: Authorization: Status is a duplicate. (187)
       * 1000: get ct0 fail
       */
      const needTwitter = Number(process.env.NEED_TWITTER) === 1
      if (needTwitter) {
        const twitterErrorCode = [32, 37, 64, 141, 187, 326, 1000]

        if (twitterErrorCode.includes(err.code)) {
          await galxe.unbindTwitter()

          const filePath = 'twitter.txt'
          const twitterAccounts = readFileToArray(filePath)

          let failAccount = null
          const filteredTwitterAccounts = twitterAccounts.filter((item: string) => {
            const included = item.includes(err.extra)
            if (included) failAccount = item

            return !included
          })

          const fileContent = filteredTwitterAccounts.join('\n')
          fs.writeFileSync(filePath, fileContent)

          if (failAccount) {
            logger.warn(`fail account is: ${failAccount}`)
            fs.appendFile('twitter-fail.txt', `${failAccount}\n`, () => {})
          }
        }
      }

      await waittingBetween(17500, 22500)
    }
  }
}

main()
