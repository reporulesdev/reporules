# skill: 인증 API 엔드포인트 추가

authentication 앱에 새 인증 관련 엔드포인트를 추가하는 흐름입니다.

---

## 대상 흐름 예시
"비밀번호 변경 API 추가" — POST `/user/password`

---

## 단계별 파일 생성 순서

### 1. serializers.py — 새 Serializer 추가

인증 관련 Serializer 공통 패턴:
```python
class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(max_length=128, write_only=True)
    new_password = serializers.CharField(max_length=128, min_length=8, write_only=True)

    def validate(self, data):
        current_password = data.get('current_password')
        new_password = data.get('new_password')

        if not self.context['request'].user.check_password(current_password):
            raise serializers.ValidationError('Current password is incorrect.')

        return {'new_password': new_password}
```

규칙:
- 비밀번호: `write_only=True`, `min_length=8`, `max_length=128`
- 토큰 반환 필요 시: `token = serializers.CharField(read_only=True)`
- User+Profile 동시 처리 시: `profile` pop 패턴 재사용 (UserSerializer 참고)

### 2. views.py — APIView 추가

모든 인증 뷰 공통 패턴:
```python
class PasswordChangeAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (UserJSONRenderer,)
    serializer_class = PasswordChangeSerializer

    def post(self, request):
        # 요청 바디 상위 키는 항상 'user'
        user_data = request.data.get('user', {})
        serializer = self.serializer_class(
            data=user_data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        # 비즈니스 로직 수행
        new_password = serializer.validated_data['new_password']
        request.user.set_password(new_password)
        request.user.save()

        return Response(
            self.serializer_class(request.user).data,
            status=status.HTTP_200_OK
        )
```

규칙:
- `renderer_classes = (UserJSONRenderer,)` 필수
- 요청 바디: `request.data.get('user', {})` 패턴
- DRF 흐름: serialize → `is_valid(raise_exception=True)` → 처리 → Response
- `save()`가 없는 경우 직접 로직 수행 후 Response

### 3. urls.py — URL 등록

```python
# conduit/apps/authentication/urls.py
urlpatterns = [
    url(r'^user/?$', UserRetrieveUpdateAPIView.as_view()),
    url(r'^users/?$', RegistrationAPIView.as_view()),
    url(r'^users/login/?$', LoginAPIView.as_view()),
    # 새로 추가
    url(r'^user/password/?$', PasswordChangeAPIView.as_view()),
]
```

---

## 시그널 기반 후처리가 필요한 경우

User 생성/수정 후 추가 작업이 필요하면 signals.py에 추가:
```python
# signals.py
@receiver(post_save, sender=User)
def on_user_updated(sender, instance, created, *args, **kwargs):
    if not created:
        # 업데이트 후 처리 로직
        pass
```

AppConfig `ready()`에 이미 `import signals`가 등록되어 있으므로 함수만 추가하면 됨.

---

## 핵심 패턴 참조

| 파일 | 참조 규칙 |
|------|-----------|
| serializers.py | `rules/conduit-apps-authentication.md` — Serializer 패턴 |
| views.py | `rules/conduit-apps-authentication.md` — View 패턴 |
| renderers.py | `rules/conduit-apps-authentication.md` — UserJSONRenderer |
| signals.py | `rules/conduit-apps-authentication.md` — 시그널 |

---

## 체크리스트

- [ ] `renderer_classes = (UserJSONRenderer,)` 지정
- [ ] 요청 바디 상위 키 `'user'` 유지
- [ ] 비밀번호 필드: `write_only=True`, 길이 제한
- [ ] 토큰 필드: `read_only=True`
- [ ] URL에 trailing slash 처리 (`/?$`)
- [ ] `is_valid(raise_exception=True)` 패턴 준수
