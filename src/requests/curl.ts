import { Curl } from 'node-libcurl'
import { isJsonString } from '../utils/common'
import 'dotenv/config'

/**
 * Curl 请求类
 */
class CurlInstance {
  private createInstance(): Curl {
    const curl = new Curl()

    curl.setOpt(Curl.option.SSL_VERIFYHOST, 0)
    curl.setOpt(Curl.option.SSL_VERIFYPEER, 0)
    curl.setOpt(Curl.option.FOLLOWLOCATION, true)

    const proxyIp = process.env.PROXY_IP
    if (proxyIp) curl.setOpt(Curl.option.PROXY, proxyIp)

    return curl
  }

  async get(url: string, headers: string[] = [], needClearCookie: boolean = false): Promise<any> {
    const curl = this.createInstance()

    curl.setOpt(Curl.option.HTTPHEADER, headers)

    if (needClearCookie) {
      curl.setOpt(Curl.option.COOKIEFILE, '')
      curl.setOpt(Curl.option.FRESH_CONNECT, true)
      curl.setOpt(Curl.option.FORBID_REUSE, true)
    }

    return new Promise((resolve, reject) => {
      curl.setOpt(Curl.option.URL, url)
      curl.setOpt(Curl.option.HTTPGET, true)

      curl.on('end', (statusCode: number, data: string, headers: object) => {
        try {
          resolve({ statusCode, headers, data: isJsonString(data) ? JSON.parse(data) : data })
        } catch (error) {
          reject(`Error parsing response: ${error}`)
        } finally {
          curl.close()
        }
      })

      curl.on('error', (err) => {
        console.error('Error:', err)
        curl.close()

        reject(err)
      })

      curl.perform()
    })
  }

  async post(url: string, payload: any, headers: string[] = []): Promise<any> {
    const curl = this.createInstance()

    curl.setOpt(Curl.option.HTTPHEADER, headers)
    curl.setOpt(Curl.option.POSTFIELDS, JSON.stringify(payload))

    return new Promise((resolve, reject) => {
      curl.setOpt(Curl.option.URL, url)
      curl.setOpt(Curl.option.POST, true)

      curl.on('end', (statusCode: number, data: string, headers: object) => {
        try {
          resolve({ statusCode, headers, data: isJsonString(data) ? JSON.parse(data) : data })
        } catch (error) {
          reject(`Error parsing response: ${error}`)
        } finally {
          curl.close()
        }
      })

      curl.on('error', (err) => {
        console.error('Error:', err)
        curl.close()

        reject(err)
      })

      curl.perform()
    })
  }
}

const curl = new CurlInstance()

export default curl
