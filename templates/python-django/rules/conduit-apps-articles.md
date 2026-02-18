---
paths:
  - "conduit/apps/articles/**/*"
---

# conduit/apps/articles

## 책임
게시글(Article), 댓글(Comment), 태그(Tag)의 CRUD 및 즐겨찾기/피드 API를 담당한다.

## 연관관계
```
Article.author --> profiles.Profile (FK)
Article.tags   --> articles.Tag (M2M)
Comment.article --> articles.Article / Comment.author --> profiles.Profile
Profile.favorites --> Article (M2M, related_name='favorited_by')
ArticlesFeedAPIView --> Profile.follows (팔로우 저자의 글)
pre_save(Article) --> signals.py --> slug 자동 생성
```

---

## 모델

```python
class Article(TimestampedModel):
    slug = models.SlugField(db_index=True, max_length=255, unique=True)
    title = models.CharField(db_index=True, max_length=255)
    body = models.TextField()
    author = models.ForeignKey('profiles.Profile', on_delete=models.CASCADE, related_name='articles')
    tags = models.ManyToManyField('articles.Tag', related_name='articles')

class Tag(TimestampedModel):
    tag = models.CharField(max_length=255)
    slug = models.SlugField(db_index=True, unique=True)
```

Slug 자동 생성 (signals.py):
```python
@receiver(pre_save, sender=Article)
def add_slug_to_article_if_not_exists(sender, instance, *args, **kwargs):
    if instance and not instance.slug:
        slug = slugify(instance.title)
        unique = generate_random_string()
        instance.slug = slug[:254 - len(unique)] + '-' + unique
```

---

## Serializer 패턴

- camelCase 필드: `SerializerMethodField(method_name='get_snake_case')`
- 태그: `TagRelatedField(many=True, source='tags')` — 입출력 모두 문자열
- 생성 시 `author`는 `context['author']`, `tags`는 pop 후 별도 add

```python
class ArticleSerializer(serializers.ModelSerializer):
    author = ProfileSerializer(read_only=True)
    tagList = TagRelatedField(many=True, required=False, source='tags')
    favorited = serializers.SerializerMethodField()
    favoritesCount = serializers.SerializerMethodField(method_name='get_favorites_count')

    def create(self, validated_data):
        author = self.context.get('author', None)
        tags = validated_data.pop('tags', [])
        article = Article.objects.create(author=author, **validated_data)
        for tag in tags: article.tags.add(tag)
        return article
```

---

## View 패턴

**ArticleViewSet**: `lookup_field = 'slug'`, 쿼리 파라미터 `author/tag/favorited` 필터

```python
class ArticleViewSet(mixins.CreateModelMixin, mixins.ListModelMixin,
                     mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    lookup_field = 'slug'
    queryset = Article.objects.select_related('author', 'author__user')
    permission_classes = (IsAuthenticatedOrReadOnly,)
    renderer_classes = (ArticleJSONRenderer,)

    def create(self, request):
        ctx = {'author': request.user.profile, 'request': request}
        data = request.data.get('article', {})
        s = self.serializer_class(data=data, context=ctx)
        s.is_valid(raise_exception=True); s.save()
        return Response(s.data, status=status.HTTP_201_CREATED)
```

피드: `Article.objects.filter(author__in=request.user.profile.follows.all())`

즐겨찾기: `profile.favorite(article)` / `profile.unfavorite(article)` 호출 후 ArticleSerializer 응답

TagListAPIView: `pagination_class = None`, 응답 `{'tags': s.data}`

---

## URL 패턴

```python
router.register(r'articles', ArticleViewSet)
url(r'^articles/feed/?$', ArticlesFeedAPIView.as_view()),
url(r'^articles/(?P<article_slug>[-\w]+)/favorite/?$', ArticlesFavoriteAPIView.as_view()),
url(r'^articles/(?P<article_slug>[-\w]+)/comments/?$', CommentsListCreateAPIView.as_view()),
url(r'^articles/(?P<article_slug>[-\w]+)/comments/(?P<comment_pk>[\d]+)/?$',
    CommentsDestroyAPIView.as_view()),
url(r'^tags/?$', TagListAPIView.as_view()),
```
