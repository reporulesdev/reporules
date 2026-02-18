---
paths:
  - "system/**/*"
---

# system

## 책임
캐시·웹 MVC 설정, 로케일 처리, 공통 컨트롤러(welcome, error 유발) 등 애플리케이션 인프라를 담당한다.

## 연관관계
```
CacheConfiguration (@EnableCaching)
  └── JCacheManagerCustomizer → "vets" 캐시 생성
WebConfiguration (WebMvcConfigurer)
  └── LocaleChangeInterceptor → InterceptorRegistry
  └── SessionLocaleResolver  → LocaleResolver 빈
WelcomeController  → GET /        → "welcome" 뷰
CrashController    → GET /oups    → RuntimeException (에러 화면 테스트)
```

## Naming

- 설정 클래스: `*Configuration` (예: `CacheConfiguration`, `WebConfiguration`)
- 컨트롤러: `*Controller` (예: `WelcomeController`, `CrashController`)
- 패키지 설명: `package-info.java`

## Constraints

### 1. 패키지 고정

```java
package org.springframework.samples.petclinic.system;
```

### 2. 설정 클래스 정의 방식

- `@Configuration(proxyBeanMethods = false)` 또는 `@Configuration`
- 빈은 `@Bean` 메서드로 정의

```java
@Configuration(proxyBeanMethods = false)
@EnableCaching
class CacheConfiguration {
    @Bean
    JCacheManagerCustomizer petclinicCacheConfigurationCustomizer() {
        return cm -> cm.createCache("vets", cacheConfiguration());
    }
}
```

### 3. 컨트롤러 정의 방식

- `@Controller`, 요청 매핑은 `@GetMapping`, 반환 타입은 뷰 이름 `String`

```java
@Controller
class WelcomeController {
    @GetMapping("/")
    String welcome() { return "welcome"; }
}
```

### 4. WebMvcConfigurer - 인터셉터 등록

- `addInterceptors` 오버라이드, 인터셉터는 `@Bean`으로 분리 정의

```java
@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    @Bean
    LocaleChangeInterceptor localeChangeInterceptor() {
        return new LocaleChangeInterceptor();
    }
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(localeChangeInterceptor());
    }
}
```
