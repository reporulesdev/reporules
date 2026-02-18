---
paths:
  - "src/shared/**/*"
---

# src/shared Guide

## 책임
모든 모듈에서 공통으로 사용하는 ValidationPipe와 JWT 토큰 헬퍼(BaseController)를 제공한다.

## 연관관계
```
각 Domain Module
  → Controller extends BaseController
      → getUserIdFromToken() (JWT 디코딩)
  → @UsePipes(new ValidationPipe())
      → ValidationPipe.transform()
          → plainToClass + class-validator.validate()
          → 실패 시 HttpException(BAD_REQUEST)
```

---

## BaseController 패턴

```ts
import * as jwt from 'jsonwebtoken';
import { SECRET } from '../config';

export class BaseController {
  protected getUserIdFromToken(authorization: string): number | null {
    if (!authorization) return null;
    const token = authorization.split(' ')[1];
    const decoded: any = jwt.verify(token, SECRET);
    return decoded.id;
  }
}
```

규칙:
- JWT user id 추출 로직은 반드시 `protected getUserIdFromToken` 인스턴스 메서드로 구현
- `../config`의 `SECRET` 상수와 `jsonwebtoken.verify` 사용
- Controller 클래스에서 상속: `export class ArticleController extends BaseController`

---

## ValidationPipe 패턴

```ts
import { Injectable, PipeTransform, ArgumentMetadata, HttpException, HttpStatus } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, metadata: ArgumentMetadata) {
    const object = plainToClass(metadata.metatype, value);
    const errors = await validate(object);
    if (errors.length > 0) {
      throw new HttpException(
        { message: 'Input data validation failed', errors: this.buildError(errors) },
        HttpStatus.BAD_REQUEST,
      );
    }
    return value;
  }

  private buildError(errors) {
    const result = {};
    errors.forEach(err => {
      const prop = err.property;
      result[prop] = Object.values(err.constraints).join(', ');
    });
    return result;
  }
}
```

규칙:
- `@Injectable()` 클래스로 선언, `PipeTransform<any>` 구현
- 메인 메서드는 `async transform(value, metadata: ArgumentMetadata)`
- `plainToClass` 후 `class-validator.validate()`로 검증
- 실패 시 에러 메시지: `'Input data validation failed'`
- HTTP 상태: `HttpStatus.BAD_REQUEST`

---

## Naming 규칙

- BaseController: `base.controller.ts` → `export class BaseController`
- ValidationPipe: `pipes/validation.pipe.ts` → `export class ValidationPipe`
- 추가 파이프: `{Domain}Pipe` 스타일 (PascalCase + Pipe 접미사)
