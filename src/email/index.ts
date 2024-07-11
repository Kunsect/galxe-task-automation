import { waitting } from '../utils/common'
import curl from '../requests/curl'

const EMAIL_URL: string = 'https://www.1secmail.com/api/v1/'

/**
 * 邮件管理类
 *
 * 基于 1secmail 的 API 实现：https://www.1secmail.com/api/
 */
export class EmailManager {
  email: string = ''

  async getEmail() {
    if (!this.email) {
      const res = await curl.get(`${EMAIL_URL}?action=genRandomMailbox`)

      this.email = res.data[0]
    }

    return this.email
  }

  async getEmailCode(): Promise<string> {
    if (!this.email) await this.getEmail()

    const [username, domain] = this.email.split('@')
    const mailParams = `login=${username}&domain=${domain}`

    let emailId
    for (let i = 0; i < 10; i++) {
      await waitting(4000)

      const receivesRes = await curl.get(`${EMAIL_URL}?action=getMessages&${mailParams}`)

      if (receivesRes.data.length) {
        emailId = receivesRes.data[0]['id']

        break
      }
    }

    if (!emailId) throw Error('uncatch email id')

    const emailRes = await curl.get(`${EMAIL_URL}?action=readMessage&id=${emailId}&${mailParams}`)

    const matches = emailRes.data.body.match(/<h1>(\d{6})</)

    return matches[1]
  }
}
