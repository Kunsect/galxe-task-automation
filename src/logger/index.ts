import winston from 'winston'
import 'dotenv/config'

/**
 * 日志类
 *
 * 参考 winston 文档：https://github.com/winstonjs/winston
 */
class Logger {
  logger: winston.Logger

  constructor() {
    const { LOGGER_OUTPUT_NAME } = process.env

    this.logger = winston
      .createLogger({
        level: 'silly',
        format: winston.format.combine(
          winston.format.label({ label: 'galxe' }),
          winston.format.timestamp({ format: 'MM.DD HH:mm:ss' }),
          this.getCustomFormat()
        ),
        transports: [...(LOGGER_OUTPUT_NAME ? [new winston.transports.File({ filename: LOGGER_OUTPUT_NAME })] : [])]
      })
      .add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.label({ label: 'galxe' }),
            this.getCustomFormat()
          )
        })
      )
  }

  private getCustomFormat = () =>
    winston.format.printf(({ level, message, label, timestamp }) => {
      return `${timestamp} ${level}: ${message}`
    })

  public debug(message: string) {
    this.logger.debug(message)
  }

  public info(message: string) {
    this.logger.info(message)
  }

  public warn(message: string) {
    this.logger.warn(message)
  }

  public error(message: string) {
    this.logger.error(message)
  }
}

const logger = new Logger()

export default logger
