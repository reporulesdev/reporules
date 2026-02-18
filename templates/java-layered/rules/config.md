---
paths:
  - "src/main/java/template/config/**/*"
---

# config

## 책임
애플리케이션 전역에서 사용하는 Spring Bean을 정의하고 등록한다.

## 연관관계
```
config (Bean 정의) -> service (ModelMapper 주입)
```

---

## Naming
- 설정 클래스: `*Config` 접미사 (예: `TemplateConfig`)

## Constraints

### 1. `@Configuration` 클래스에 `@Bean` 메서드로 등록
```java
@Configuration
public class TemplateConfig {

    @Bean
    public ModelMapper modelMapper() {
        return new ModelMapper();
    }
}
```

- 클래스에 `@Configuration` 필수
- Bean은 `@Bean` 메서드로 등록
- 메서드명이 Bean 이름이 됨
