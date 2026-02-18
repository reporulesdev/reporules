---
paths:
  - "app/email-templates/**/*"
---

# app/email-templates

## 책임
사용자에게 발송되는 이메일의 HTML 레이아웃과 콘텐츠를 MJML로 정의한다.

## 연관관계
```
app/email-templates/*.mjml
    ↓ MJML 컴파일
app/email-templates/build/*.html
    ↓ app/core/email.py (send_email)
사용자 이메일 수신
```

## Naming

- 파일명: 스네이크 케이스, 용도 직접 표현
  - `new_account.mjml`, `reset_password.mjml`, `test_email.mjml`

## Constraints

### 1. 공통 레이아웃 구조

모든 템플릿 공통 최상위 구조:

```mjml
<mjml>
  <mj-body background-color="#fafbfc">
    <mj-section background-color="#fff" padding="40px 20px">
      <mj-column vertical-align="middle" width="100%">
        <!-- 콘텐츠 -->
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

- `<mj-body>`: `background-color="#fafbfc"`
- `<mj-section>`: `background-color="#fff"`, `padding="40px 20px"`
- `<mj-column>`: `vertical-align="middle"`, `width="100%"`

### 2. 헤더 텍스트 패턴

```mjml
<mj-text align="center" padding="35px" font-size="20px"
         font-family="Arial, Helvetica, sans-serif" color="#333">
  {{ project_name }} - Password Recovery
</mj-text>
```

### 3. 본문 텍스트 패턴

```mjml
<mj-text align="center" font-size="16px"
         padding-left="25px" padding-right="25px"
         font-family="Arial, Helvetica, sans-serif" color="#555">
  Hello {{ username }}
</mj-text>
```

### 4. 버튼 패턴

```mjml
<mj-button align="center" font-size="18px"
           background-color="#009688" border-radius="8px"
           color="#fff" href="{{ link }}" padding="15px 30px">
  Reset password
</mj-button>
```

### 5. 구분선 패턴

```mjml
<mj-divider border-color="#ccc" border-width="2px"></mj-divider>
```

### 6. 템플릿 변수

- 표기: `{{ variable_name }}`
- 공통 변수: `{{ project_name }}`
- 템플릿별 변수:
  - `new_account.mjml`: `{{ username }}`, `{{ password }}`, `{{ link }}`
  - `reset_password.mjml`: `{{ username }}`, `{{ link }}`, `{{ valid_hours }}`
  - `test_email.mjml`: `{{ email }}`
