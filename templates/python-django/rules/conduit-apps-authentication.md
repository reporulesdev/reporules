---
paths:
  - "conduit/apps/authentication/**/*"
---

# conduit/apps/authentication

## 책임
JWT 기반 사용자 인증/계정 관리(회원가입, 로그인, 프로필 업데이트)를 담당한다.

## 연관관계
```
HTTP 요청 --> JWTAuthentication (backends.py) --> User 조회
RegistrationAPIView / LoginAPIView / UserRetrieveUpdateAPIView
  --> UserJSONRenderer --> {"user": {...}}
User 생성(post_save) --> signals.py --> Profile.objects.create(user=instance)
UserSerializer.update --> User + Profile 동시 저장
```

---

## User 모델

```python
class User(AbstractBaseUser, PermissionsMixin, TimestampedModel):
    username = models.CharField(db_index=True, max_length=255, unique=True)
    email = models.EmailField(db_index=True, unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    objects = UserManager()

    @property
    def token(self): return self._generate_jwt_token()

    def _generate_jwt_token(self):
        dt = datetime.now() + timedelta(days=60)
        token = jwt.encode({'id': self.pk, 'exp': int(dt.strftime('%s'))},
                           settings.SECRET_KEY, algorithm='HS256')
        return token.decode('utf-8')
```
- 토큰 payload: `{'id': self.pk, 'exp': <60일 후 unix timestamp>}`
- User 생성: `UserManager.create_user` 또는 `create_superuser`만 사용

---

## JWTAuthentication

헤더 형식: `Authorization: Token <jwt>` (요소 정확히 2개)

```python
class JWTAuthentication(authentication.BaseAuthentication):
    authentication_header_prefix = 'Token'

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).split()
        if not auth_header or len(auth_header) != 2:
            return None
        prefix = auth_header[0].decode('utf-8')
        token = auth_header[1].decode('utf-8')
        if prefix.lower() != self.authentication_header_prefix.lower():
            return None
        return self._authenticate_credentials(request, token)
```
- 형식 오류 시 `None` 반환, 토큰 무효/비활성 시 `AuthenticationFailed`

---

## Serializer 패턴

- **RegistrationSerializer**: `password` write_only, `token` read_only, create는 `create_user` 호출
- **LoginSerializer**: `validate`에서 `authenticate(username=email, ...)`, `save()` 없음
- **UserSerializer**: User+Profile 동시 업데이트

```python
def update(self, instance, validated_data):
    password = validated_data.pop('password', None)
    profile_data = validated_data.pop('profile', {})
    for (key, value) in validated_data.items(): setattr(instance, key, value)
    if password is not None: instance.set_password(password)
    instance.save()
    for (key, value) in profile_data.items(): setattr(instance.profile, key, value)
    instance.profile.save()
    return instance
```

---

## View 패턴

공통: `renderer_classes = (UserJSONRenderer,)`, 요청 바디 상위 키 `'user'`

```python
class RegistrationAPIView(APIView):
    permission_classes = (AllowAny,)
    def post(self, request):
        user = request.data.get('user', {})
        serializer = self.serializer_class(data=user)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
```

- LoginAPIView: `save()` 호출 없음, HTTP 200
- UserRetrieveUpdateAPIView: `IsAuthenticated`, `partial=True`

---

## 시그널

```python
@receiver(post_save, sender=User)
def create_related_profile(sender, instance, created, *args, **kwargs):
    if instance and created:
        instance.profile = Profile.objects.create(user=instance)
```
AppConfig `ready()`에서 `import conduit.apps.authentication.signals`로 로딩
