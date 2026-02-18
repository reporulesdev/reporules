---
paths:
  - "go-rest-api-example/internal/utilities/**/*"
---

# utilities

## 책임
시간 포맷 변환, 개발 모드 판별, 랜덤 가격 생성, 주문 총액 계산 등 순수 유틸리티 함수를 제공한다.

## 연관관계
```
handlers → utilities.FormatTimeToISO   (time.Time → string)
server   → utilities.IsDevMode         (환경 이름 → bool)
handlers → utilities.CalculateTotalAmount ([]data.Product → float64)
handlers → utilities.RandomPrice       (시드 데이터 생성 시)
```

---

## Naming

- 함수: 동사/행위 중심 PascalCase (`FormatTimeToISO`, `IsDevMode`, `CalculateTotalAmount`)
- 공개 상수: PascalCase (`MaxPrice`)
- 내부 상수: camelCase (`defaultPrice`)
- 테스트 패키지: `utilities_test`, 함수: `Test{함수명}`

## Constraints

### 1. 시간 포맷: RFC3339, 현재 시간은 UTC 기준

```go
func FormatTimeToISO(t time.Time) string { return t.Format(time.RFC3339) }
func CurrentISOTime() string { return FormatTimeToISO(time.Now().UTC()) }
```

### 2. 개발 모드: `"local"` 또는 `"dev"` 포함 여부로 판별

```go
func IsDevMode(s string) bool {
    return strings.Contains(s, "local") || strings.Contains(s, "dev")
}
```

### 3. 랜덤 가격: `crypto/rand`, 실패 시 `defaultPrice` 반환

```go
const (defaultPrice = 100; MaxPrice = 1000)

func RandomPrice() float64 {
    price, err := rand.Int(rand.Reader, big.NewInt(MaxPrice))
    if err != nil { price = big.NewInt(defaultPrice) }
    pf, _ := price.Float64()
    return pf
}
```

### 4. 총액 계산: `Price * float64(Quantity)` 합산, 빈 슬라이스는 0 반환

```go
func CalculateTotalAmount(products []data.Product) float64 {
    var total float64
    for _, p := range products { total += p.Price * float64(p.Quantity) }
    return total
}
```

### 5. 테스트: 테이블 방식, 경계값 포함

```go
func TestIsDevMode(t *testing.T) {
    cases := []struct{ in string; out bool }{
        {"dev", true}, {"local", true}, {"test", false}, {"production", false},
    }
    for _, tc := range cases { assert.Equal(t, tc.out, utilities.IsDevMode(tc.in)) }
}
```
