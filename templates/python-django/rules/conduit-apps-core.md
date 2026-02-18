---
paths:
  - "conduit/apps/core/**/*"
---

# conduit/apps/core

## 책임
프로젝트 전역 공통 인프라(TimestampedModel, JSON 렌더러, 예외 처리, 유틸)를 제공한다.

## 연관관계
```
모든 앱 모델 --> TimestampedModel (상속)
모든 앱 렌더러 --> ConduitJSONRenderer (상속)
DRF 예외 --> core_exception_handler --> _handle_*_error
articles.signals --> generate_random_string (utils)
```

---

## TimestampedModel

```python
class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True
        ordering = ['-created_at', '-updated_at']
```
- `abstract = True` 필수
- 기본 정렬: `created_at`, `updated_at` 내림차순

---

## ConduitJSONRenderer

응답 구조 규칙:
- 페이지네이션(`results` 키 존재): `{pagination_object_label: results, count: count}`
- 에러(`errors` 키 존재): DRF 기본 JSONRenderer 그대로 사용
- 일반: `{object_label: data}`

```python
class ConduitJSONRenderer(JSONRenderer):
    charset = 'utf-8'
    object_label = 'object'
    pagination_object_label = 'objects'
    pagination_object_count = 'count'

    def render(self, data, media_type=None, renderer_context=None):
        if data.get('results') is not None:
            return json.dumps({
                self.pagination_object_label: data['results'],
                self.pagination_object_count: data['count'],
            })
        if data.get('errors') is not None:
            return super().render(data)
        return json.dumps({self.object_label: data})
```

---

## 예외 처리

핸들러 선택: `exc.__class__.__name__` 기반 딕셔너리 매핑

```python
def core_exception_handler(exc, context):
    response = exception_handler(exc, context)
    handlers = {
        'NotFound': _handle_not_found_error,
        'ValidationError': _handle_generic_error,
    }
    exception_class = exc.__class__.__name__
    if exception_class in handlers:
        return handlers[exception_class](exc, context, response)
    return response

def _handle_generic_error(exc, context, response):
    response.data = {'errors': response.data}
    return response

def _handle_not_found_error(exc, context, response):
    view = context.get('view')
    if view and getattr(view, 'queryset', None) is not None:
        error_key = view.queryset.model._meta.verbose_name
        response.data = {'errors': {error_key: response.data['detail']}}
    else:
        response = _handle_generic_error(exc, context, response)
    return response
```

---

## 유틸

```python
DEFAULT_CHAR_STRING = string.ascii_lowercase + string.digits

def generate_random_string(chars=DEFAULT_CHAR_STRING, size=6):
    return ''.join(random.choice(chars) for _ in range(size))
```
- 상수명: 대문자 스네이크 케이스
- 함수명: 동사 기반 스네이크 케이스
