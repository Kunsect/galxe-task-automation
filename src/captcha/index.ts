import logger from '../logger'
import curl from '../requests/curl'
import { waitting } from '../utils/common'
import 'dotenv/config'

const CAPSOLVER_API_URL: string = 'https://api.capsolver.com'
const TWO_CAPTCHA_API_URL: string = 'https://api.2captcha.com'

const GALXE_URL: string = 'https://app.galxe.com/quest'
const GALXE_CAPTCHA_ID: string = '244bcb8b9846215df5af4c624a750db4'

export interface ICaptchaParams {
  captchaOutput: string
  genTime: string
  lotNumber: string
  passToken: string
}

interface ITaskPayload {
  type: string
  websiteURL: string
  [key: string]: any
}

export class CaptchaDecoder {
  apiUrl?: string
  clientKey?: string
  taskPayload: ITaskPayload = {
    type: 'GeeTestTaskProxyless',
    websiteURL: GALXE_URL
  }

  constructor() {
    const { CAPSOLVER_CLIENT_KEY, TWO_CAPTCHA_CLIENT_KEY } = process.env

    if (TWO_CAPTCHA_CLIENT_KEY) this.initializeTwoCaptcha()
    else if (CAPSOLVER_CLIENT_KEY) this.initializeCapsolver()
  }

  private initializeTwoCaptcha() {
    const { TWO_CAPTCHA_CLIENT_KEY } = process.env

    this.clientKey = TWO_CAPTCHA_CLIENT_KEY
    this.apiUrl = TWO_CAPTCHA_API_URL
    this.taskPayload = {
      ...this.taskPayload,
      version: 4,
      initParameters: { captcha_id: GALXE_CAPTCHA_ID }
    }
  }

  private initializeCapsolver() {
    const { CAPSOLVER_CLIENT_KEY } = process.env

    this.clientKey = CAPSOLVER_CLIENT_KEY
    this.apiUrl = CAPSOLVER_API_URL
    this.taskPayload = {
      ...this.taskPayload,
      captchaId: GALXE_CAPTCHA_ID,
      geetestApiServerSubdomain: 'graphigo.prd.galaxy.eco'
    }
  }

  private async createTask() {
    const payload = {
      clientKey: this.clientKey,
      task: this.taskPayload
    }

    const res = await curl.post(`${this.apiUrl}/createTask`, payload)

    return res.data.taskId
  }

  private async getTaskResult(taskId: string): Promise<ICaptchaParams | null> {
    while (true) {
      await waitting(1000)

      const getResultPayload = { clientKey: this.clientKey, taskId }
      const resp = await curl.post(`${this.apiUrl}/getTaskResult`, getResultPayload)
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

  async getCaptcha(): Promise<ICaptchaParams | null> {
    let res = null

    for (let i = 0; i < 5; i++) {
      try {
        const taskId = await this.createTask()
        if (taskId) res = await this.getTaskResult(taskId)

        if (!res) throw Error('get captcha fail')
        else break
      } catch (err) {
        if (i < 4) logger.warn(`[Captcha] (${i + 1} / 5) will try again.`)
        else logger.error(`[Captcha] all trying failed.`)
      }
    }

    return res
  }
}
