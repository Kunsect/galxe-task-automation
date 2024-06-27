import axios from 'axios'
import { waitting } from './common'
import 'dotenv/config'

export interface CaptchaParams {
  captchaOutput: string
  genTime: string
  lotNumber: string
  passToken: string
}

/**
 * 解码类
 *
 * Galxe 使用了 Geetest 的平台进行验证
 * capsolver 提供了对 Geetest 的解码
 * 官网：https://capsolver.com
 */
export class Capsolver {
  private CLIENT_KEY: string = process.env.CAPSOLVER_CLIENT_KEY!
  private BASE_URL: string = 'https://api.capsolver.com'
  private GALXE_CAPTCHA_ID: string = '244bcb8b9846215df5af4c624a750db4'

  constructor() {}

  private async createTask() {
    const payload = {
      clientKey: this.CLIENT_KEY,
      task: {
        type: 'GeetestTaskProxyless',
        websiteURL: 'https://app.galxe.com/quest',
        captchaId: this.GALXE_CAPTCHA_ID,
        geetestApiServerSubdomain: 'graphigo.prd.galaxy.eco'
      }
    }

    const res = await axios.post(`${this.BASE_URL}/createTask`, payload)

    return res.data.taskId
  }

  private async getTaskResult(taskId: string): Promise<CaptchaParams | null> {
    while (true) {
      await waitting(1000)

      const getResultPayload = { clientKey: this.CLIENT_KEY, taskId }
      const resp = await axios.post(`${this.BASE_URL}/getTaskResult`, getResultPayload)
      const status = resp.data.status

      if (status === 'ready') {
        const { captcha_output, gen_time, lot_number, pass_token } = resp.data.solution

        return {
          captchaOutput: captcha_output,
          genTime: gen_time,
          lotNumber: lot_number,
          passToken: pass_token
        }
      }

      if (status === 'failed' || resp.data.errorId) {
        console.log('Solve failed! response:', resp.data)

        return null
      }
    }
  }

  async getCaptcha(): Promise<CaptchaParams | null> {
    const taskId = await this.createTask()

    return this.getTaskResult(taskId)
  }
}
