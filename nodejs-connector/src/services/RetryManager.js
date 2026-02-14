class RetryManager {
  constructor(maxAttempts = 3, baseDelaySeconds = 5, logger) {
    this.maxAttempts = maxAttempts;
    this.baseDelaySeconds = baseDelaySeconds;
    this.logger = logger;
  }

  async execute(operation, operationName = 'operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        this.logger.debug(`Attempting ${operationName} (attempt ${attempt}/${this.maxAttempts})`);
        
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxAttempts) {
          this.logger.error(`${operationName} failed after ${this.maxAttempts} attempts`, {
            error: error.message,
            attempts: attempt
          });
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        
        this.logger.warn(`${operationName} failed on attempt ${attempt}, retrying in ${delay}ms`, {
          error: error.message,
          nextAttempt: attempt + 1
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    // Add jitter to prevent thundering herd
    const baseDelay = this.baseDelaySeconds * 1000; // Convert to milliseconds
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 0-10% jitter
    return Math.round(exponentialDelay + jitter);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper method to check if an error is retryable
  isRetryableError(error) {
    // Network errors
    if (error.code && ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'].includes(error.code)) {
      return true;
    }
    
    // HTTP errors that are typically retryable
    if (error.response && error.response.status) {
      const status = error.response.status;
      // Retry on 5xx server errors and specific 4xx errors
      return status >= 500 || status === 429 || status === 408 || status === 409;
    }
    
    // Default to not retrying
    return false;
  }

  // Execute with custom retry logic
  async executeWithCustomRetry(operation, shouldRetry, operationName = 'operation') {
    let lastError;
    let attempt = 1;
    
    while (attempt <= this.maxAttempts) {
      try {
        this.logger.debug(`Attempting ${operationName} (attempt ${attempt}/${this.maxAttempts})`);
        
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this specific error
        const shouldRetryError = shouldRetry(error, attempt);
        
        if (!shouldRetryError || attempt === this.maxAttempts) {
          this.logger.error(`${operationName} failed after ${attempt} attempts`, {
            error: error.message,
            attempts: attempt,
            shouldRetry: shouldRetryError
          });
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        
        this.logger.warn(`${operationName} failed on attempt ${attempt}, retrying in ${delay}ms`, {
          error: error.message,
          nextAttempt: attempt + 1,
          shouldRetry: shouldRetryError
        });
        
        await this.sleep(delay);
        attempt++;
      }
    }
    
    throw lastError;
  }
}

module.exports = RetryManager;