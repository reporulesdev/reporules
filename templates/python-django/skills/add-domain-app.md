# skill: 신규 도메인 앱 전체 추가

새 Django 앱(도메인)을 이 프로젝트 구조에 맞게 처음부터 추가하는 흐름입니다.

---

## 대상 흐름 예시
"알림(Notification) 앱 추가" — `conduit/apps/notifications/`

---

## 단계별 파일 생성 순서

### 1. 앱 디렉토리 및 __init__.py (AppConfig)

```python
# conduit/apps/notifications/__init__.py
from django.apps import AppConfig

class NotificationsAppConfig(AppConfig):
    name = 'conduit.apps.notifications'
    label = 'notifications'
    verbose_name = 'Notifications'

    def ready(self):
        # signals 사용 시 아래 주석 해제
        # import conduit.apps.notifications.signals
        pass

default_app_config = 'conduit.apps.notifications.NotificationsAppConfig'
```

### 2. models.py — TimestampedModel 상속

```python
# conduit/apps/notifications/models.py
from conduit.apps.core.models import TimestampedModel

class Notification(TimestampedModel):
    recipient = models.ForeignKey(
        'profiles.Profile', on_delete=models.CASCADE, related_name='notifications'
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)

    def __str__(self): return f'Notification for {self.recipient}'
```

### 3. migrations/ — 초기 마이그레이션

```bash
python manage.py makemigrations notifications
python manage.py migrate
```

### 4. renderers.py — ConduitJSONRenderer 서브클래스

```python
# conduit/apps/notifications/renderers.py
from conduit.apps.core.renderers import ConduitJSONRenderer

class NotificationJSONRenderer(ConduitJSONRenderer):
    object_label = 'notification'
    pagination_object_label = 'notifications'
    pagination_count_label = 'notificationsCount'
```

### 5. serializers.py — ModelSerializer

```python
# conduit/apps/notifications/serializers.py
from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    createdAt = serializers.SerializerMethodField(method_name='get_created_at')

    class Meta:
        model = Notification
        fields = ('id', 'message', 'is_read', 'createdAt')

    def get_created_at(self, instance):
        return instance.created_at.isoformat()
```

### 6. views.py — APIView/GenericAPIView

```python
# conduit/apps/notifications/views.py
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Notification
from .renderers import NotificationJSONRenderer
from .serializers import NotificationSerializer

class NotificationListAPIView(generics.ListAPIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (NotificationJSONRenderer,)
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user.profile)

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        s = self.serializer_class(page, many=True)
        return self.get_paginated_response(s.data)
```

### 7. urls.py

```python
# conduit/apps/notifications/urls.py
from django.conf.urls import url
from .views import NotificationListAPIView

urlpatterns = [
    url(r'^notifications/?$', NotificationListAPIView.as_view()),
]
```

### 8. 프로젝트 settings 및 루트 urls.py에 등록

```python
# settings.py INSTALLED_APPS에 추가
'conduit.apps.notifications',

# conduit/urls.py에 include 추가
url(r'^api/', include('conduit.apps.notifications.urls', namespace='notifications')),
```

---

## 핵심 패턴 참조

| 파일 | 참조 규칙 |
|------|-----------|
| models.py | `rules/conduit-apps-core.md` — TimestampedModel |
| renderers.py | `rules/conduit-apps-core.md` — ConduitJSONRenderer |
| serializers.py | `rules/conduit-apps-articles.md` — camelCase SerializerMethodField 패턴 |
| views.py | `rules/conduit-apps-articles.md` — ArticleViewSet 패턴 |

---

## 체크리스트

- [ ] `__init__.py`에 `AppConfig` + `default_app_config` 설정
- [ ] 모델은 `TimestampedModel` 상속
- [ ] 렌더러는 `ConduitJSONRenderer` 상속, 레이블 3개 정의
- [ ] Serializer camelCase 필드는 `SerializerMethodField` 사용
- [ ] 모든 뷰에 `renderer_classes` 명시
- [ ] INSTALLED_APPS 및 루트 urls.py 등록
- [ ] migration 생성 및 적용
