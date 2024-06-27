import winston from 'winston'

/**
 * 日志类
 *
 * 参考 winston 文档：https://github.com/winstonjs/winston
 */
export class Logger {
  logger: winston.Logger

  constructor() {
    this.logger = winston
      .createLogger({
        level: 'silly',
        format: winston.format.combine(
          winston.format.label({ label: 'galxe' }),
          winston.format.timestamp({ format: 'MM.DD HH:mm' }),
          this.getCustomFormat()
        ),
        transports: [
          new winston.transports.File({ filename: 'galxe-error.log', level: 'error' }),
          new winston.transports.File({ filename: 'galxe-combined.log' })
        ]
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
      return `${timestamp} [${label}] ${level}: ${message}`
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
