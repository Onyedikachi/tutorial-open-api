import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TLSSocket } from 'node:tls';
import { CertificateValidator } from './certificate-validator.service';

@Injectable()
export class MTLSMiddleware implements NestMiddleware {
  constructor(private certValidator: CertificateValidator) {}

  use(req: Request, res: Response, next: NextFunction) {
    const socket = req.socket as TLSSocket;

    if (!socket.authorized) {
      throw new UnauthorizedException('Client certificate not authorized');
    }

    const cert = socket.getPeerCertificate();

    if (!cert || !Object.keys(cert).length) {
      throw new UnauthorizedException('Client certificate required');
    }

    const isValid = this.certValidator.validateCertificate(cert);
    if (!isValid) {
      throw new UnauthorizedException('Invalid client certificate');
    }

    req['client'] = {
      cn: cert.subject?.CN,
      organization: cert.subject?.O,
      serialNumber: cert.serialNumber,
    };

    next();
  }
}
