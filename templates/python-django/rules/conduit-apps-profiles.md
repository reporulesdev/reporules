---
paths:
  - "conduit/apps/profiles/**/*"
---

# conduit/apps/profiles

## 책임
사용자 프로필 조회, 팔로우/언팔로우, 즐겨찾기(favorite) 비즈니스 로직을 담당한다.

## 연관관계
```
authentication.User --1:1--> Profile
Profile.follows --> Profile (self M2M, symmetrical=False)
Profile.favorites --> articles.Article (M2M, related_name='favorited_by')
ProfileSerializer <-- context['request'] --> following 계산
ProfileRetrieveAPIView (AllowAny) / ProfileFollowAPIView (IsAuthenticated)
  --> ProfileJSONRenderer --> {"profile": {...}}
```

---

## Profile 모델

```python
class Profile(TimestampedModel):
    user = models.OneToOneField('authentication.User', on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    image = models.URLField(blank=True)
    follows = models.ManyToManyField('self', related_name='followed_by', symmetrical=False)
    favorites = models.ManyToManyField('articles.Article', related_name='favorited_by')

    def follow(self, profile): self.follows.add(profile)
    def unfollow(self, profile): self.follows.remove(profile)
    def is_following(self, profile): return self.follows.filter(pk=profile.pk).exists()
    def favorite(self, article): self.favorites.add(article)
    def unfavorite(self, article): self.favorites.remove(article)
    def has_favorited(self, article): return self.favorites.filter(pk=article.pk).exists()
```

---

## ProfileSerializer

```python
class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    image = serializers.SerializerMethodField()
    following = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ('username', 'bio', 'image', 'following',)
        read_only_fields = ('username',)

    def get_image(self, obj):
        if obj.image: return obj.image
        return 'https://static.productionready.io/images/smiley-cyrus.jpg'

    def get_following(self, instance):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated(): return False
        return request.user.profile.is_following(instance)
```

- `username`: `source='user.username'`, read_only
- 기본 이미지 URL: 하드코딩 (`obj.image` 비어있을 때)
- `following`: 항상 `context={'request': request}` 전달 필요

---

## View 패턴

```python
class ProfileRetrieveAPIView(RetrieveAPIView):
    permission_classes = (AllowAny,)
    queryset = Profile.objects.select_related('user')
    renderer_classes = (ProfileJSONRenderer,)
    serializer_class = ProfileSerializer

    def retrieve(self, request, username, *args, **kwargs):
        try:
            profile = self.queryset.get(user__username=username)
        except Profile.DoesNotExist:
            raise NotFound('A profile with this username does not exist.')
        serializer = self.serializer_class(profile, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
```

```python
class ProfileFollowAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (ProfileJSONRenderer,)

    def post(self, request, username=None):
        follower = self.request.user.profile
        followee = Profile.objects.get(user__username=username)
        if follower.pk is followee.pk:
            raise serializers.ValidationError('You can not follow yourself.')
        follower.follow(followee)
        serializer = self.serializer_class(followee, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, username=None):
        follower = self.request.user.profile
        followee = Profile.objects.get(user__username=username)
        follower.unfollow(followee)
        serializer = self.serializer_class(followee, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
```

---

## URL 패턴

```python
urlpatterns = [
    url(r'^profiles/(?P<username>\w+)/?$', ProfileRetrieveAPIView.as_view()),
    url(r'^profiles/(?P<username>\w+)/follow/?$', ProfileFollowAPIView.as_view()),
]
```

## 예외

```python
class ProfileDoesNotExist(APIException):
    status_code = 400
    default_detail = 'The requested profile does not exist.'
```
