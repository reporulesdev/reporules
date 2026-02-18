---
paths:
  - "system/**/*"
---

# system

## 책임

애플리케이션 전역 설정(캐시)과 루트·오류 처리 유틸 컨트롤러를 제공하는 인프라 구획이다.

## 연관관계

```
CacheConfig → JCacheManagerCustomizer → "vets" 캐시 등록 → VetRepository(@Cacheable)
WelcomeController → "welcome" 뷰
CrashController   → RuntimeException 발생 (에러 처리 테스트용)
```

---

## Naming

- 패키지: 모든 파일은 `org.springframework.samples.petclinic.system` 패키지 사용
- 설정 클래스: `*Config` 접미사 (예: `CacheConfig`)
- 컨트롤러 클래스: `*Controller` 접미사 (예: `WelcomeController`, `CrashController`)

## Constraints

### 컨트롤러

- `@Controller` 사용, 요청 매핑은 `@GetMapping`으로 선언

```kotlin
@Controller
class WelcomeController {
    @GetMapping("/")
    fun welcome(): String = "welcome"
}
```

```kotlin
@Controller
class CrashController {
    @GetMapping("/oups")
    fun triggerException() {
        throw RuntimeException("Expected: controller used to showcase what happens when an exception is thrown")
    }
}
```

### 캐시 설정

- `@Configuration(proxyBeanMethods = false)` + `@EnableCaching` 사용
- `@Bean` 메서드로 `JCacheManagerCustomizer` 등록
- 캐시 이름은 문자열 상수로 `createCache("vets", ...)` 형태로 등록

```kotlin
@Configuration(proxyBeanMethods = false)
@EnableCaching
class CacheConfig {
    @Bean
    fun cacheManagerCustomizer(): JCacheManagerCustomizer = JCacheManagerCustomizer {
        it.createCache("vets", createCacheConfiguration())
    }
}
```
