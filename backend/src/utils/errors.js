// Erro previsível da aplicação: carrega status HTTP e um código estável para o frontend.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code, message) => new AppError(400, code, message);
export const unauthorized = (code, message) => new AppError(401, code, message);
export const forbidden = (code, message) => new AppError(403, code, message);
export const notFound = (code, message) => new AppError(404, code, message);
export const conflict = (code, message) => new AppError(409, code, message);
export const paymentRequired = (code, message) => new AppError(402, code, message);
export const tooManyRequests = (code, message) => new AppError(429, code, message);
export const serviceUnavailable = (code, message) => new AppError(503, code, message);
