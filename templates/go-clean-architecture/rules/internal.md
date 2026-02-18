---
paths:
  - "go-backend-clean-architecture/internal/**/*"
---

# internal Guide

## 책임
프로젝트 내부 공통 유틸리티 패키지 — JWT 토큰 생성·검증, 테스트용 fake 유틸.

## 연관관계
```
internal/tokenutil → domain (User 타입 참조)
usecase → internal/tokenutil (토큰 로직 위임)
api/middleware → internal/tokenutil (JWT 검증)
```

## 패키지 구조

```
internal/
  tokenutil/
    tokenutil.go    # JWT 생성·검증 함수
  fakeutil/
    fakeutil.go     # 테스트용 유틸
```

## 패턴 1: 패키지 네이밍

```go
// internal/tokenutil/tokenutil.go
package tokenutil

// internal/fakeutil/fakeutil.go
package fakeutil
```

- 유틸리티 패키지명: `{name}util` 형식, 소문자, 단일 단어
- 파일명: 패키지명과 동일 (`tokenutil.go`, `fakeutil.go`)

## 패턴 2: tokenutil 공개 함수

```go
package tokenutil

func CreateAccessToken(user *domain.User, secret string, expiry int) (string, error) { /* ... */ }
func CreateRefreshToken(user *domain.User, secret string, expiry int) (string, error) { /* ... */ }
func IsAuthorized(requestToken, secret string) (bool, error) { /* ... */ }
func ExtractIDFromToken(requestToken, secret string) (string, error) { /* ... */ }
```

## 규칙

- 모든 함수는 exported (대문자 시작) — 패키지 외부에서 사용
- JWT 관련 로직은 모두 `tokenutil` 패키지에 집중
- `usecase`에서 토큰 생성·파싱이 필요할 때는 이 패키지에 위임 (thin wrapper 패턴)
- 새 유틸리티 패키지 추가 시: `internal/{name}util/{name}util.go` 형식 유지
