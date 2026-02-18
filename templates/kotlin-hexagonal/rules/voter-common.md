---
paths:
  - "voter-common/**/*"
---

# voter-common

## 책임
모든 모듈이 공유하는 공통 어노테이션을 제공 - 특히 내부 패키지 가시성을 표시하는 `@InternalPackage`

## 연관관계
```
voter-common (@InternalPackage)
  --> adapter-output/.../internal/package-info.java  (내부 구현 패키지 표시)
  --> voter-ms/.../internal/package-info.java
  --> voter-lambda/.../internal/package-info.java
```

---

## 패턴

### @InternalPackage 어노테이션

```java
@Target(ElementType.PACKAGE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface InternalPackage {}
```

### package-info.java에서의 사용

```java
// adapter-output/.../internal/package-info.java
@InternalPackage
package com.hexarchbootdemo.adapter.output.persistence.h2.internal;

import com.hexarchbootdemo.common.InternalPackage;
```

---

## 규칙

- `@InternalPackage`는 `package-info.java`에만 적용
- `@Target(ElementType.PACKAGE)`: 패키지 수준 어노테이션
- `@Retention(RetentionPolicy.RUNTIME)`: 런타임까지 유지 (아키텍처 검사 등에 활용 가능)
- `@Documented`: 문서화 대상으로 포함
- 이 어노테이션이 붙은 패키지의 클래스는 외부 패키지에서 직접 참조 금지
