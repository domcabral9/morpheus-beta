import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type { Response } from "express";

/**
 * Sem isto, uma exceção não tratada (bug num service, erro de driver do
 * Postgres etc.) chegaria ao Express cru — stack trace e mensagem interna
 * de volta pro cliente. HttpException (400/403/404/...) já formatadas pelos
 * controllers/services passam direto; qualquer outra coisa vira um 500
 * genérico na resposta, com o detalhe completo só no log estruturado.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error({ err: exception }, "Exceção não tratada");
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Erro interno do servidor.",
    });
  }
}
