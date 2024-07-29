import * as fs from 'fs'
import logger from './../src/logger'
import { Galxe } from './../src/galxe'
import { waittingBetween } from './../src/utils/common'
import 'dotenv/config'
import { WalletManager } from '../src/wallet'

const main = async () => {
  let pathIndex: number = Number(process.env.START_PATH_INDEX)
  const maxPathIndex: number = Number(process.env.MAX_PATH_INDEX)

  while (pathIndex < maxPathIndex) {
    const galxe = new Galxe(pathIndex)

    try {
      await galxe.authLogin()

      const userScore = await galxe.getSpaceScore(process.env.SPACE_NAME!)
      const wallet = new WalletManager(pathIndex)

      fs.appendFile(
        'score.txt',
        `index: ${pathIndex}, privateKey: ${wallet.evmWallet.privateKey}, score: ${userScore.addressLoyaltyPoints.points}, rank: ${userScore.addressLoyaltyPoints.rank}\n`,
        () => {}
      )

      pathIndex += 1
    } catch (err: any) {
      logger.error(err.message)
      logger.debug('uncatch error，waitting 20s to continue...')

      await waittingBetween(17500, 22500)
    }
  }
}

main()
