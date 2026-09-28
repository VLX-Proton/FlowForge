export interface ExecutionLog {
  timestamp: number
  level: 'info' | 'warning' | 'error'
  message: string
}

export class ExecutionLogger {
  private logs: ExecutionLog[] = []
  private maxLogs: number = 100

  log(message: string): void {
    this.append('info', message)
  }

  warn(message: string): void {
    this.append('warning', message)
  }

  error(message: string): void {
    this.append('error', message)
  }

  private append(
    level: 'info' | 'warning' | 'error',
    message: string,
  ): void {
    const log: ExecutionLog = {
      timestamp: Date.now(),
      level,
      message,
    }

    this.logs.push(log)

    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  getLogs(): ExecutionLog[] {
    return [...this.logs]
  }

  getLatest(
    level?: 'info' | 'warning' | 'error',
  ): ExecutionLog | null {
    if (!level) {
      return this.logs[this.logs.length - 1] || null
    }

    for (
      let i = this.logs.length - 1;
      i >= 0;
      i--
    ) {
      if (this.logs[i].level === level) {
        return this.logs[i]
      }
    }

    return null
  }

  clear(): void {
    this.logs = []
  }

  format(log: ExecutionLog): string {
    const time = new Date(log.timestamp)
      .toLocaleTimeString()

    return `[${time}] ${log.message}`
  }
}

export function createExecutionLogger(): ExecutionLogger {
  return new ExecutionLogger()
}
