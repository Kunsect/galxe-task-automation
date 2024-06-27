import { Curl } from 'node-libcurl'
import 'dotenv/config'

/**
 * Curl 请求类
 */
class CurlRequest {
  newInstance() {
    const curl = new Curl()

    curl.setOpt(Curl.option.SSL_VERIFYHOST, 0)
    curl.setOpt(Curl.option.SSL_VERIFYPEER, 0)

    const proxyIp = process.env.PROXY_IP
    if (proxyIp) curl.setOpt(Curl.option.PROXY, proxyIp)

    return curl
  }

  setHeaders(curl: Curl, headers: string[]): void {
    curl.setOpt(Curl.option.HTTPHEADER, headers)
  }

  setPostFields(curl: Curl, payload: object): void {
    curl.setOpt(Curl.option.POSTFIELDS, JSON.stringify(payload))
  }

  async get(url: string, headers?: string[]): Promise<any> {
    const curl = this.newInstance()

    this.setHeaders(curl, headers || [])

    return new Promise((resolve, reject) => {
      curl.setOpt(Curl.option.URL, url)
      curl.setOpt(Curl.option.HTTPGET, true)

      curl.on('end', (statusCode: number, data: string, headers: object) => {
        try {
          resolve({ statusCode, headers, data: JSON.parse(data) })
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

  async post(url: string, payload: object, headers: string[]): Promise<any> {
    const curl = this.newInstance()

    this.setPostFields(curl, payload)
    this.setHeaders(curl, headers)

    return new Promise((resolve, reject) => {
      curl.setOpt(Curl.option.URL, url)
      curl.setOpt(Curl.option.POST, true)

      curl.on('end', (statusCode: number, data: string, headers: object) => {
        try {
          resolve({ statusCode, headers, data: JSON.parse(data) })
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

export default CurlRequest
