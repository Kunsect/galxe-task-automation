import * as fs from 'fs'

export const waitting = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const waittingBetween = (minMs: number, maxMs: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (maxMs - minMs)) + minMs))

export const formatDate = (date: Date, format: string): string => {
  const pad = (n: number): string => (n < 10 ? '0' + n : n.toString())

  return format
    .replace('yyyy', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('dd', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()))
}

export const randomString = (len: number, needBigWord: boolean = false) => {
  let chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  if (needBigWord) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const maxPos = chars.length
  let str = ''
  for (let i = 0; i < len; i++) {
    str += chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return str
}

export const isJsonString = (data: any) => {
  try {
    JSON.parse(data)
    return true
  } catch (error) {
    return false
  }
}

export const readFileToArray = (filePath: string): string[] => {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    if (!data) return []

    const lines = data.split('\n')

    return lines.map((line) => line.trim())
  } catch (error) {
    console.error('Error reading file:', error)
    return []
  }
}
