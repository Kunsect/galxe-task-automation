import { Galxe, IUser } from './galxe'
import { waitting } from './utils/common'
import { Logger } from './utils/logger'
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

  const logger: Logger = new Logger()

  while (pathIndex < maxPathIndex) {
    let userInfo: IUser

    const galxe = new Galxe(pathIndex)

    try {
      await galxe.authLogin()

      const galxeIdExist = await galxe.checkGalxeIdExist()

      if (!galxeIdExist) {
        logger.warn('galxe id not exist, go to create new account.')

        await galxe.createNewAccount()
      }

      userInfo = await galxe.getUserInfo()

      if (!userInfo.bitcoinSignetAddress) await galxe.bindSignetAddress()
      else logger.warn(`User has already bound an address, skip the address binding step.`)

      if (!userInfo.email) await galxe.bindEmail()
      else logger.warn(`User has already bound an email address, skip the email binding step.`)

      await galxe.startCampaigns()

      logger.info('============== galxe tasks finish! continue next path ==============')

      pathIndex += 1
    } catch (err: any) {
      logger.error(`${err.message}`)
      logger.debug('waitting 12s to continue...')

      await waitting(12000)

      pathIndex += 1
      continue
    }
  }
}

main()
